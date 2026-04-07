"""Encolar exportaciones LST."""
from __future__ import annotations

from typing import Any

from ...drive_audit import DriveFreshnessHints
from ...enqueue_types import EnqueueResult
from ...drive_export_gate import DriveExportGate
from ...lib import yearmonth as ym_lib
from ... import paths
from ... import vectors
from . import csv_tasks
from . import geojson_tasks
from . import incremental as lst_inc
from . import raster_tasks


def _add_tasks(out: list[Any], items: list[Any] | Any | None) -> None:
    if items is None:
        return
    if isinstance(items, list):
        out.extend(t for t in items if t is not None)
    else:
        out.append(items)


def enqueue_lst_exports(
    *,
    only: set[str] | None = None,
    skip_yearly: bool = False,
    force_full: bool = False,
    drive_gate: DriveExportGate | None = None,
    drive_freshness: DriveFreshnessHints | None = None,
    tables_run_override: bool | None = None,
    persist_state: bool = True,
) -> EnqueueResult:
    drive: list[Any] = []
    asset: list[Any] = []
    sync: set[str] = set()
    sync_full_mirror: set[str] = set()
    messages: list[str] = []
    ran_derivative = False

    def want(name: str) -> bool:
        return only is None or name in only

    missing = lst_inc.list_missing_lst_yearmonth_months()
    plan = lst_inc.plan_derivative_exports(
        missing_asset_months=missing,
        force_full=force_full,
    )
    ic = vectors.lst_yearmonth_collection()

    if want("asset"):
        _add_tasks(asset, raster_tasks.start_lst_ym_asset_tasks())

    if want("raster"):
        if missing:
            messages.append("[raster LST] Asset incompleto: omitidos derivados.")
        else:
            if skip_yearly:
                messages.append(
                    "LST: omitidos tendencia y anual raster (--include-yearly para encolarlos)."
                )
            else:
                if lst_inc.should_refresh_trend_raster(ic):
                    tr = raster_tasks.start_lst_trend_raster_task(
                        drive_gate=drive_gate,
                        bypass_drive_gate=True,
                    )
                    _add_tasks(drive, tr)
                    if tr:
                        sync.add("lst_raster_trend")
                        ran_derivative = True
                        lst_inc.save_last_trend_raster_full_year(
                            ym_lib.effective_yearly_export_year(ic)
                        )
                bypass_yearly = bool(
                    drive_freshness and drive_freshness.yearly_raster_enqueue_bypass
                )
                _add_tasks(
                    drive,
                    raster_tasks.start_lst_yearly_raster_last_year_task(
                        drive_gate=drive_gate,
                        bypass_drive_gate=bypass_yearly,
                    ),
                )
                sync.add("lst_raster_yearly")
                ran_derivative = True

            stale_local_wall = ym_lib.monthly_local_rasters_stale_vs_last_completed_year(
                paths.REPO_RASTER_LST_MONTHLY, "LST_Monthly_"
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
                        "[raster LST] Climatología mensual: mtime local vs año civil cerrado "
                        f"{ym_lib.last_completed_wall_clock_calendar_year()}."
                    )
                _add_tasks(
                    drive,
                    raster_tasks.start_lst_monthly_raster_tasks(
                        month_numbers=None if full_refresh else plan.month_subset,
                        drive_gate=drive_gate,
                        bypass_drive_gate=full_refresh,
                    ),
                )
                sync.add("lst_raster_monthly")
                ran_derivative = True
                if full_refresh:
                    sync_full_mirror.add("lst_raster_monthly")
            if drive_freshness:
                sync_full_mirror |= set(drive_freshness.sync_full_mirror_extra_keys)

    tables_run = (
        plan.run or plan.is_full_refresh or force_full
        if tables_run_override is None
        else tables_run_override
    )

    if want("csv") and tables_run:
        _add_tasks(drive, csv_tasks.start_lst_csv_tasks(drive_gate=drive_gate))
        sync.update({"lst_csv_monthly", "lst_csv_yearly"})
        ran_derivative = True
    elif want("csv"):
        messages.append("Omitidos CSV LST (sin delta).")

    if want("geojson") and tables_run:
        _add_tasks(
            drive,
            geojson_tasks.start_lst_m_geojson_tasks(
                month_numbers=None if plan.is_full_refresh else plan.month_subset,
                drive_gate=drive_gate,
            ),
        )
        sync.update({"lst_geo_monthly_b", "lst_geo_monthly_m"})
        if not skip_yearly:
            _add_tasks(
                drive,
                geojson_tasks.start_lst_y_geojson_tasks(drive_gate=drive_gate),
            )
            _add_tasks(
                drive,
                geojson_tasks.start_lst_t_geojson_tasks(drive_gate=drive_gate),
            )
            sync.update(
                {
                    "lst_geo_yearly_b",
                    "lst_geo_yearly_m",
                    "lst_geo_trend_b",
                    "lst_geo_trend_m",
                }
            )
        ran_derivative = True
    elif want("geojson"):
        messages.append("Omitidos GeoJSON LST (sin delta).")

    state_saved = False
    state_path_msg = ""
    if persist_state and plan.run and ran_derivative and plan.max_ym:
        lst_inc.save_last_processed_ym(plan.max_ym)
        state_saved = True
        state_path_msg = str(lst_inc.state_path())

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
