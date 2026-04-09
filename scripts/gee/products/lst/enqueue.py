"""Encolar exportaciones LST (asset anual + monthly directo)."""
from __future__ import annotations

from typing import Any

from ...drive.drive_audit import DriveFreshnessHints
from ...config.enqueue_types import EnqueueResult
from ...drive.drive_export_gate import DriveExportGate
from ...lib import yearmonth as ym_lib
from ...config import paths
from ...earth_engine_init import vectors
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

    missing_years = lst_inc.list_missing_lst_yearly()
    plan = lst_inc.plan_derivative_exports(
        missing_asset_years=missing_years,
        force_full=force_full,
    )

    # --- Phase: yearly assets ---
    if want("asset"):
        _add_tasks(asset, raster_tasks.start_lst_yearly_asset_tasks(missing_years))

    # --- Phase: rasters ---
    if want("raster"):
        # Monthly climatology: always available (direct from Landsat, no asset needed)
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
            if full_refresh and drive_gate:
                drive_gate.clear_before_reexport(
                    paths.DRIVE_LST_RASTER_MONTHLY,
                    stem_prefixes=("LST_Monthly_",),
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

        # Yearly + trend rasters: need completed yearly assets
        if missing_years:
            messages.append(
                "[raster LST] Asset anual incompleto: omitidos raster anual y tendencia."
            )
        else:
            ic = vectors.lst_yearly_collection()
            if lst_inc.should_refresh_trend_raster(ic):
                if drive_gate:
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_LST_RASTER_YEARLY,
                        stem_prefixes=("LST_Yearly_Trend",),
                    )
                tr = raster_tasks.start_lst_trend_raster_task(
                    ic,
                    drive_gate=drive_gate,
                    bypass_drive_gate=True,
                )
                _add_tasks(drive, tr)
                if tr:
                    sync.add("lst_raster_trend")
                    ran_derivative = True
                    max_y = ym_lib.get_collection_max_year(ic)
                    if max_y:
                        lst_inc.save_last_trend_raster_full_year(max_y)

            yearly_needed = (
                drive_freshness is not None
                and drive_freshness.yearly_raster_missing_or_stale
            )
            if skip_yearly and not yearly_needed:
                messages.append(
                    "LST: omitidos anuales raster (--include-yearly)."
                )
            else:
                bypass_yearly = bool(
                    drive_freshness and drive_freshness.yearly_raster_enqueue_bypass
                )
                if bypass_yearly and drive_gate:
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_LST_RASTER_YEARLY,
                        stem_prefixes=("LST_Yearly_",),
                        stem_exclude_substrings=("Trend",),
                    )
                _add_tasks(
                    drive,
                    raster_tasks.start_lst_yearly_raster_last_year_task(
                        ic,
                        drive_gate=drive_gate,
                        bypass_drive_gate=bypass_yearly,
                    ),
                )
                sync.add("lst_raster_yearly")
                ran_derivative = True

        if drive_freshness:
            sync_full_mirror |= set(drive_freshness.sync_full_mirror_extra_keys)

    # --- Phase: tables ---
    force_yearly_tables = bool(
        drive_freshness and drive_freshness.yearly_tables_missing_or_stale
    )
    tables_run = (
        plan.run or plan.is_full_refresh or force_full or force_yearly_tables
        if tables_run_override is None
        else tables_run_override
    )

    if want("csv") and tables_run:
        if drive_gate:
            drive_gate.clear_before_reexport(
                paths.DRIVE_LST_CSV_MONTHLY, extensions=(".csv",),
                stem_prefixes=("LST_m_",),
            )
            drive_gate.clear_before_reexport(
                paths.DRIVE_LST_CSV_YEARLY, extensions=(".csv",),
                stem_prefixes=("LST_y_",),
            )
        _add_tasks(drive, csv_tasks.start_lst_csv_tasks(drive_gate=drive_gate))
        sync.update({"lst_csv_monthly", "lst_csv_yearly"})
        ran_derivative = True
    elif want("csv"):
        messages.append("Omitidos CSV LST (asset anual incompleto).")

    if want("geojson"):
        # Monthly GeoJSON: always available (direct from Landsat)
        if tables_run:
            month_filter = None if plan.is_full_refresh else plan.month_subset
            months_to_refresh = (
                range(1, 13)
                if month_filter is None
                else sorted(x for x in month_filter if 1 <= x <= 12)
            )
            if drive_gate:
                drive_gate.clear_before_reexport(
                    paths.DRIVE_LST_GEO_MONTHLY_B,
                    extensions=(".geojson", ".json"),
                    file_stems=tuple(
                        f"LST_Monthly_ZonalStats_Barrios_{m:02d}"
                        for m in months_to_refresh
                    ),
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_LST_GEO_MONTHLY_M,
                    extensions=(".geojson", ".json"),
                    file_stems=tuple(
                        f"LST_Monthly_ZonalStats_Manzanas_{m:02d}"
                        for m in months_to_refresh
                    ),
                )
            _add_tasks(
                drive,
                geojson_tasks.start_lst_m_geojson_tasks(
                    month_numbers=month_filter,
                    drive_gate=drive_gate,
                ),
            )
            sync.update({"lst_geo_monthly_b", "lst_geo_monthly_m"})
            ran_derivative = True

        # Trend GeoJSON: always recalculate when yearly assets are complete
        if not missing_years and tables_run:
            if drive_gate:
                drive_gate.clear_before_reexport(
                    paths.DRIVE_LST_GEO_TREND_B, extensions=(".geojson", ".json"),
                    stem_prefixes=("Trend_LST_ZonalStats_Barrios",),
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_LST_GEO_TREND_M, extensions=(".geojson", ".json"),
                    stem_prefixes=("Trend_LST_ZonalStats_Manzanas",),
                )
            _add_tasks(
                drive,
                geojson_tasks.start_lst_t_geojson_tasks(drive_gate=drive_gate),
            )
            sync.update({"lst_geo_trend_b", "lst_geo_trend_m"})
            ran_derivative = True

        # Yearly GeoJSON: auto-export when Drive is missing yearly files
        geo_yearly_needed = bool(
            drive_freshness
            and (
                drive_freshness.yearly_raster_missing_or_stale
                or drive_freshness.yearly_tables_missing_or_stale
            )
        )
        if (not skip_yearly or geo_yearly_needed) and not missing_years and tables_run:
            _add_tasks(
                drive,
                geojson_tasks.start_lst_y_geojson_tasks(drive_gate=drive_gate),
            )
            sync.update({"lst_geo_yearly_b", "lst_geo_yearly_m"})
            ran_derivative = True
        elif want("geojson") and missing_years:
            messages.append("Omitidos GeoJSON anuales/trend LST (asset anual incompleto).")

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
