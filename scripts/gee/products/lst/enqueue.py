"""Encolar exportaciones LST (asset anual + monthly directo)."""
from __future__ import annotations

from typing import Any

import ee

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
from . import suhi_tasks
from .constants import LST_START_YEAR


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
        # Monthly climatology: only when new source data
        run_m = plan.run or plan.is_full_refresh or force_full
        if run_m:
            full_refresh = plan.is_full_refresh or force_full
            if full_refresh and drive_gate:
                drive_gate.clear_before_reexport(
                    paths.DRIVE_LST_RASTER_MONTHLY,
                    stem_prefixes=("LST_Monthly_",),
                    reason="refresco climatología mensual LST (datos nuevos en GEE)",
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
        else:
            messages.append(
                "[raster LST] Climatología mensual: sin meses nuevos en fuente GEE."
            )

        # Yearly + trend rasters: need completed yearly assets
        if missing_years:
            messages.append(
                "[raster LST] Asset anual incompleto: omitidos raster anual y tendencia."
            )
        else:
            ic = vectors.lst_yearly_collection().filter(
                ee.Filter.gte("year", LST_START_YEAR)
            )
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

            # --- Yearly rasters: fill ALL missing years ---
            missing_raster_years = [
                y
                for y in (drive_freshness.missing_yearly_raster_years if drive_freshness else [])
                if y >= LST_START_YEAR
            ]
            yearly_needed = bool(missing_raster_years)
            if skip_yearly and not yearly_needed:
                messages.append(
                    "LST: omitidos anuales raster (--include-yearly)."
                )
            else:
                year_nums = missing_raster_years or None
                bypass_yr = bool(missing_raster_years)
                if bypass_yr and drive_gate:
                    for yr in missing_raster_years:
                        drive_gate.clear_before_reexport(
                            paths.DRIVE_LST_RASTER_YEARLY,
                            file_stems=(f"LST_Yearly_{yr}",),
                            reason=f"falta año {yr} en Drive",
                        )
                _add_tasks(
                    drive,
                    raster_tasks.start_lst_yearly_raster_tasks(
                        ic,
                        year_numbers=year_nums,
                        drive_gate=drive_gate,
                        bypass_drive_gate=bypass_yr,
                    ),
                )
                sync.add("lst_raster_yearly")
                ran_derivative = True

        if drive_freshness:
            sync_full_mirror |= set(drive_freshness.sync_full_mirror_extra_keys)

    # --- Phase: tables (granular csv / geo separation, same as NDVI) ---
    force_yearly_csv = bool(
        drive_freshness and drive_freshness.yearly_csv_missing_or_stale
    )
    force_yearly_geo = bool(
        drive_freshness and drive_freshness.yearly_geo_missing_or_stale
    )
    csv_run = (
        (plan.run or plan.is_full_refresh or force_full or force_yearly_csv)
        if tables_run_override is None
        else tables_run_override
    )
    geo_run = (
        (plan.run or plan.is_full_refresh or force_full or force_yearly_geo)
        if tables_run_override is None
        else tables_run_override
    )
    tables_run = csv_run or geo_run

    local_stale_drive_ok = bool(
        drive_freshness and drive_freshness.local_tables_stale_drive_ok
    )

    if want("csv") and csv_run and local_stale_drive_ok:
        sync.update({"lst_csv_monthly", "lst_csv_yearly"})
        ran_derivative = True
        messages.append(
            "CSV LST: Drive ya tiene versión reciente; descargando sin re-exportar."
        )
    elif want("csv") and csv_run:
        if drive_gate:
            drive_gate.clear_before_reexport(
                paths.DRIVE_LST_CSV_MONTHLY, extensions=(".csv",),
                stem_prefixes=("LST_m_",),
                reason="re-export CSV mensual LST",
            )
            drive_gate.clear_before_reexport(
                paths.DRIVE_LST_CSV_YEARLY, extensions=(".csv",),
                stem_prefixes=("LST_y_",),
                reason="re-export CSV anual LST",
            )
        _add_tasks(drive, csv_tasks.start_lst_csv_tasks(drive_gate=drive_gate))
        sync.update({"lst_csv_monthly", "lst_csv_yearly"})
        ran_derivative = True
    elif want("csv"):
        messages.append("Omitidos CSV LST — sin datos nuevos ni CSV inválidos.")

    if want("geojson"):
        run_monthly_geo = plan.run or plan.is_full_refresh or force_full
        if run_monthly_geo:
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
                    reason="re-export GeoJSON mensual LST",
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_LST_GEO_MONTHLY_M,
                    extensions=(".geojson", ".json"),
                    file_stems=tuple(
                        f"LST_Monthly_ZonalStats_Manzanas_{m:02d}"
                        for m in months_to_refresh
                    ),
                    reason="re-export GeoJSON mensual LST",
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
        elif tables_run:
            messages.append(
                "Omitidos: GeoJSON mensuales LST (sin meses nuevos; solo tablas anuales pendientes)."
            )

        # Trend GeoJSON: ONLY when there's new source data, NOT when CSVs are stale
        need_trend_geo = plan.run or plan.is_full_refresh or force_full
        if not missing_years and need_trend_geo:
            if drive_gate:
                drive_gate.clear_before_reexport(
                    paths.DRIVE_LST_GEO_TREND_B, extensions=(".geojson", ".json"),
                    stem_prefixes=("Trend_LST_ZonalStats_Barrios",),
                    reason="re-export GeoJSON tendencia LST",
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_LST_GEO_TREND_M, extensions=(".geojson", ".json"),
                    stem_prefixes=("Trend_LST_ZonalStats_Manzanas",),
                    reason="re-export GeoJSON tendencia LST",
                )
            _add_tasks(
                drive,
                geojson_tasks.start_lst_t_geojson_tasks(drive_gate=drive_gate),
            )
            sync.update({"lst_geo_trend_b", "lst_geo_trend_m"})
            ran_derivative = True
        elif not missing_years and not need_trend_geo:
            messages.append(
                "Omitidos: GeoJSON tendencia LST — sin datos nuevos en fuente GEE."
            )

        # Yearly GeoJSON: only when geo files are missing/invalid
        missing_geo_yrs = [
            y
            for y in (drive_freshness.missing_yearly_geo_years if drive_freshness else [])
            if y >= LST_START_YEAR
        ]
        geo_yearly_needed = bool(missing_geo_yrs)
        if (not skip_yearly or geo_yearly_needed) and not missing_years and geo_run:
            if missing_geo_yrs and drive_gate:
                for yr in missing_geo_yrs:
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_LST_GEO_YEARLY_B,
                        extensions=(".geojson", ".json"),
                        file_stems=(f"LST_Yearly_ZonalStats_Barrios_{yr}",),
                        reason=f"GeoJSON anual Barrios {yr} inválido/faltante — re-export",
                    )
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_LST_GEO_YEARLY_M,
                        extensions=(".geojson", ".json"),
                        file_stems=(f"LST_Yearly_ZonalStats_Manzanas_{yr}",),
                        reason=f"GeoJSON anual Manzanas {yr} inválido/faltante — re-export",
                    )
            _add_tasks(
                drive,
                geojson_tasks.start_lst_y_geojson_tasks(
                    year_numbers=missing_geo_yrs or None,
                    drive_gate=drive_gate,
                ),
            )
            sync.update({"lst_geo_yearly_b", "lst_geo_yearly_m"})
            ran_derivative = True
        elif want("geojson") and missing_years:
            messages.append("Omitidos GeoJSON anuales/trend LST (asset anual incompleto).")
        elif not geo_run:
            messages.append("Omitidos: GeoJSON anuales LST — sin datos faltantes/inválidos.")

    # --- Phase: SUHI (Surface Urban Heat Island) yearly GeoJSON ---
    if want("suhi") or want("geojson"):
        if not missing_years:
            ic_suhi = vectors.lst_yearly_collection().filter(
                ee.Filter.gte("year", LST_START_YEAR)
            )
            suhi_local_dir = paths.REPO_GEOJSON_LST_SUHI_YEARLY
            all_suhi_raw = (
                ic_suhi.aggregate_array("year").distinct().sort().getInfo() or []
            )
            max_y = ym_lib.get_collection_max_year(ic_suhi)
            wall = ym_lib.last_completed_wall_clock_calendar_year()
            cap_year = min(max_y, wall) if max_y else wall
            expected_suhi_years = [int(y) for y in all_suhi_raw if int(y) <= cap_year]
            existing_suhi = set()
            if suhi_local_dir.is_dir():
                for fp in suhi_local_dir.iterdir():
                    nm = fp.stem
                    if nm.startswith("LST_SUHI_Yearly_") and fp.suffix == ".geojson":
                        try:
                            existing_suhi.add(int(nm.split("_")[-1]))
                        except ValueError:
                            pass
            missing_suhi = sorted(
                y for y in expected_suhi_years if y not in existing_suhi
            )
            if missing_suhi:
                yrs_str = ", ".join(str(y) for y in missing_suhi)
                messages.append(f"[SUHI] Años faltantes: [{yrs_str}]")
                if drive_gate:
                    for yr in missing_suhi:
                        drive_gate.clear_before_reexport(
                            paths.DRIVE_LST_SUHI_YEARLY,
                            extensions=(".geojson",),
                            file_stems=(f"LST_SUHI_Yearly_{yr}",),
                            reason=f"SUHI faltante año {yr}",
                        )
                _add_tasks(
                    drive,
                    suhi_tasks.start_lst_suhi_yearly_tasks(
                        ic_suhi,
                        year_numbers=missing_suhi,
                        drive_gate=drive_gate,
                        bypass_drive_gate=True,
                    ),
                )
                sync.add("lst_suhi_yearly")
                ran_derivative = True
            else:
                messages.append("[SUHI] Todos los años presentes localmente.")
        else:
            messages.append("[SUHI] Omitido (asset anual LST incompleto).")

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
