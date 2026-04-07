"""Encolar exportaciones NO2 / SO2."""
from __future__ import annotations

from typing import Any

import ee

from ...drive_audit import DriveFreshnessHints
from ...enqueue_types import EnqueueResult
from ...drive_export_gate import DriveExportGate
from ...lib import yearmonth as ym_lib
from .spec import PollutantSpec, no2_spec, so2_spec
from . import tasks_core as tc


def _add_tasks(out: list[Any], items: list[Any] | Any | None) -> None:
    if items is None:
        return
    if isinstance(items, list):
        out.extend(t for t in items if t is not None)
    else:
        out.append(items)


def _enqueue_s5p(
    spec: PollutantSpec,
    *,
    only: set[str] | None,
    skip_yearly: bool,
    force_full: bool,
    drive_gate: DriveExportGate | None,
    drive_freshness: DriveFreshnessHints | None = None,
    tables_run_override: bool | None = None,
    persist_state: bool,
    sync_prefix: str,
) -> EnqueueResult:
    drive: list[Any] = []
    asset: list[Any] = []
    sync: set[str] = set()
    sync_full_mirror: set[str] = set()
    messages: list[str] = []
    ran_derivative = False

    def want(name: str) -> bool:
        return only is None or name in only

    missing = tc.list_missing_ym(spec)
    plan = tc.plan_derivative_exports(
        spec,
        missing_asset_months=missing,
        force_full=force_full,
    )
    ic = ee.ImageCollection(spec.asset_ym)

    if want("asset"):
        _add_tasks(asset, tc.start_ym_asset_tasks(spec))

    if want("raster"):
        if missing:
            messages.append(
                f"[raster {spec.key}] Asset año-mes incompleto: omitidos derivados."
            )
        else:
            if skip_yearly:
                messages.append(
                    f"{spec.key.upper()}: omitidos tendencia y anuales (--include-yearly)."
                )
            else:
                if tc.should_refresh_trend_raster(spec, ic):
                    tr = tc.start_trend_raster_task(
                        spec,
                        drive_gate=drive_gate,
                        bypass_drive_gate=True,
                    )
                    _add_tasks(drive, tr)
                    if tr:
                        sync.add(f"{sync_prefix}_raster_trend")
                        ran_derivative = True
                        tc.save_last_trend_raster_full_year(
                            spec, ym_lib.effective_yearly_export_year(ic)
                        )
                bypass_yearly = bool(
                    drive_freshness and drive_freshness.yearly_raster_enqueue_bypass
                )
                _add_tasks(
                    drive,
                    tc.start_yearly_raster_tasks(
                        spec,
                        drive_gate=drive_gate,
                        bypass_drive_gate=bypass_yearly,
                    ),
                )
                sync.add(f"{sync_prefix}_raster_yearly")
                ran_derivative = True

            monthly_prefix = f"{spec.key.upper()}_Monthly_"
            stale_local_wall = ym_lib.monthly_local_rasters_stale_vs_last_completed_year(
                spec.repo_raster_m, monthly_prefix
            )
            drive_force_monthly = (
                drive_freshness.force_full_monthly_raster_export
                if drive_freshness
                else False
            )
            run_m = (
                plan.run
                or plan.is_full_refresh
                or force_full
                or drive_force_monthly
                or stale_local_wall
            )
            if run_m:
                full_refresh = (
                    plan.is_full_refresh
                    or force_full
                    or drive_force_monthly
                    or stale_local_wall
                )
                if stale_local_wall and not drive_force_monthly:
                    messages.append(
                        f"[raster {spec.key.upper()}] Climatología mensual: mtime local vs "
                        f"año civil cerrado {ym_lib.last_completed_wall_clock_calendar_year()}."
                    )
                _add_tasks(
                    drive,
                    tc.start_monthly_raster_tasks(
                        spec,
                        month_numbers=None if full_refresh else plan.month_subset,
                        drive_gate=drive_gate,
                        bypass_drive_gate=full_refresh,
                    ),
                )
                sync.add(f"{sync_prefix}_raster_monthly")
                ran_derivative = True
                if full_refresh:
                    sync_full_mirror.add(f"{sync_prefix}_raster_monthly")
            if drive_freshness:
                sync_full_mirror |= set(drive_freshness.sync_full_mirror_extra_keys)

    tables_run = (
        plan.run or plan.is_full_refresh or force_full
        if tables_run_override is None
        else tables_run_override
    )

    if want("csv") and tables_run:
        _add_tasks(drive, tc.start_csv_tasks(spec, drive_gate=drive_gate))
        sync.update(
            {f"{sync_prefix}_csv_monthly", f"{sync_prefix}_csv_yearly"}
        )
        ran_derivative = True
    elif want("csv"):
        messages.append(f"Omitidos CSV {spec.key.upper()} (sin delta).")

    if want("geojson") and tables_run:
        _add_tasks(
            drive,
            tc.start_m_geojson_tasks(
                spec,
                month_numbers=None if plan.is_full_refresh else plan.month_subset,
                drive_gate=drive_gate,
            ),
        )
        sync.update(
            {
                f"{sync_prefix}_geo_monthly_b",
                f"{sync_prefix}_geo_monthly_m",
            }
        )
        if not skip_yearly:
            _add_tasks(drive, tc.start_y_geojson_tasks(spec, drive_gate=drive_gate))
            _add_tasks(drive, tc.start_t_geojson_tasks(spec, drive_gate=drive_gate))
            sync.update(
                {
                    f"{sync_prefix}_geo_yearly_b",
                    f"{sync_prefix}_geo_yearly_m",
                    f"{sync_prefix}_geo_trend_b",
                    f"{sync_prefix}_geo_trend_m",
                }
            )
        ran_derivative = True
    elif want("geojson"):
        messages.append(f"Omitidos GeoJSON {spec.key.upper()} (sin delta).")

    state_saved = False
    state_path_msg = ""
    if persist_state and plan.run and ran_derivative and plan.max_ym:
        tc.save_last_processed_ym(spec, plan.max_ym)
        state_saved = True
        state_path_msg = str(tc.state_path(spec))

    return EnqueueResult(
        plan=plan,
        drive_tasks=drive,
        asset_tasks=asset,
        sync_keys=sync,
        sync_full_mirror_keys=sync_full_mirror,
        ran_derivative=ran_derivative,
        messages=messages,
        state_saved=state_saved,
        state_path_msg=state_path_msg,
    )


def enqueue_no2_exports(
    *,
    only: set[str] | None = None,
    skip_yearly: bool = False,
    force_full: bool = False,
    drive_gate: DriveExportGate | None = None,
    drive_freshness: DriveFreshnessHints | None = None,
    tables_run_override: bool | None = None,
    persist_state: bool = True,
) -> EnqueueResult:
    return _enqueue_s5p(
        no2_spec(),
        only=only,
        skip_yearly=skip_yearly,
        force_full=force_full,
        drive_gate=drive_gate,
        drive_freshness=drive_freshness,
        tables_run_override=tables_run_override,
        persist_state=persist_state,
        sync_prefix="no2",
    )


def enqueue_so2_exports(
    *,
    only: set[str] | None = None,
    skip_yearly: bool = False,
    force_full: bool = False,
    drive_gate: DriveExportGate | None = None,
    drive_freshness: DriveFreshnessHints | None = None,
    tables_run_override: bool | None = None,
    persist_state: bool = True,
) -> EnqueueResult:
    return _enqueue_s5p(
        so2_spec(),
        only=only,
        skip_yearly=skip_yearly,
        force_full=force_full,
        drive_gate=drive_gate,
        drive_freshness=drive_freshness,
        tables_run_override=tables_run_override,
        persist_state=persist_state,
        sync_prefix="so2",
    )
