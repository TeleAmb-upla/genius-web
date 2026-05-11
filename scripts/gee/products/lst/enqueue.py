"""Encolar exportaciones LST (fuente ``LST_YearMonth``; anual derivado en GEE)."""
from __future__ import annotations

from typing import Any

import ee

from ...drive.drive_audit import DriveFreshnessHints
from ...config.enqueue_types import EnqueueResult
from ...drive.drive_export_gate import DriveExportGate
from ...lib import yearmonth as ym_lib
from ...lib.product_enqueue import add_tasks, export_want, resolve_tables_phase_pollutant
from ...config import paths
from ...earth_engine_init import vectors
from . import csv_tasks
from . import geojson_tasks
from . import incremental as lst_inc
from . import raster_tasks
from . import suhi_tasks
from .asset_bounds import lst_asset_min_year


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

    missing_ym = lst_inc.list_missing_lst_yearmonth_months()
    plan = lst_inc.plan_derivative_exports(
        missing_asset_months=missing_ym,
        force_full=force_full,
    )

    # --- Phase 1: asset año–mes ``LST_YearMonth`` (Landsat → toAsset) ---
    if export_want(only, "asset"):
        add_tasks(asset, raster_tasks.start_lst_yearmonth_asset_tasks())

    # --- Phase: rasters ---
    if export_want(only, "raster"):
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
            add_tasks(
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

        # Yearly + trend rasters (serie anual derivada desde LST_YearMonth)
        lo = lst_asset_min_year()
        ic = vectors.lst_yearly_collection().filter(
            ee.Filter.gte("year", lo)
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
            add_tasks(drive, tr)
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
            if y >= lo
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
            add_tasks(
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

    # --- Fase tablas (misma lógica AOD/S5P; ver ``resolve_tables_phase_pollutant``) ---
    tp = resolve_tables_phase_pollutant(
        plan,
        force_full=force_full,
        drive_freshness=drive_freshness,
        tables_run_override=tables_run_override,
    )
    csv_run = tp.csv_run
    ym_csv_download_only = tp.ym_csv_download_only
    geo_run = tp.geo_run
    tables_run = tp.tables_run
    local_stale_drive_ok = tp.local_stale_drive_ok

    if export_want(only, "csv") and ym_csv_download_only:
        sync.add("lst_csv_monthly")
        messages.append(
            "CSV LST año-mes: falta o inválido en local; descargando desde Drive "
            "(climatología mensual local OK)."
        )
    elif export_want(only, "csv") and csv_run and local_stale_drive_ok:
        sync.update({"lst_csv_monthly", "lst_csv_yearly"})
        ran_derivative = True
        messages.append(
            "CSV LST: Drive ya tiene versión reciente; descargando sin re-exportar."
        )
    elif export_want(only, "csv") and csv_run:
        lst_sem_bad = bool(
            drive_freshness
            and getattr(drive_freshness, "lst_yearly_urban_semantics_bad", False),
        )
        lst_scope = getattr(drive_freshness, "lst_yearly_csv_clear_scope", "all") or "all"
        lst_yearly_urban_only = bool(lst_sem_bad and lst_scope == "urban_only")

        if drive_gate:
            if lst_yearly_urban_only:
                drive_gate.clear_before_reexport(
                    paths.DRIVE_LST_CSV_YEARLY,
                    extensions=(".csv",),
                    file_stems=("LST_y_urban",),
                    reason="re-export solo LST_y_urban (incoherencia CSV anual vs año–mes)",
                )
            else:
                drive_gate.clear_before_reexport(
                    paths.DRIVE_LST_CSV_MONTHLY, extensions=(".csv",),
                    stem_prefixes=("LST_m_", "LST_YearMonth_urban"),
                    reason="re-export CSV mensual LST",
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_LST_CSV_YEARLY, extensions=(".csv",),
                    stem_prefixes=("LST_y_",),
                    reason="re-export CSV anual LST",
                )
        add_tasks(drive, csv_tasks.start_lst_csv_tasks(drive_gate=drive_gate))
        if lst_yearly_urban_only:
            sync.add("lst_csv_yearly")
            messages.append(
                "CSV LST: solo ``LST_y_urban`` marcado para re-export (tablas mensuales/zonal "
                "anuales locales válidas)."
            )
        else:
            sync.update({"lst_csv_monthly", "lst_csv_yearly"})
        ran_derivative = True
    elif export_want(only, "csv"):
        messages.append("Omitidos CSV LST — sin datos nuevos ni CSV inválidos.")

    if export_want(only, "geojson"):
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
            add_tasks(
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
        if need_trend_geo:
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
            add_tasks(
                drive,
                geojson_tasks.start_lst_t_geojson_tasks(drive_gate=drive_gate),
            )
            sync.update({"lst_geo_trend_b", "lst_geo_trend_m"})
            ran_derivative = True
        elif not need_trend_geo:
            messages.append(
                "Omitidos: GeoJSON tendencia LST — sin datos nuevos en fuente GEE."
            )

        # Yearly GeoJSON: only when geo files are missing/invalid
        drive_missing_geo_yrs = [
            y
            for y in (drive_freshness.drive_missing_yearly_geo_years if drive_freshness else [])
            if y >= lst_asset_min_year()
        ]
        local_invalid_geo_yrs = [
            y
            for y in (drive_freshness.local_invalid_yearly_geo_years if drive_freshness else [])
            if y >= lst_asset_min_year()
        ]
        geo_yearly_needed = bool(drive_missing_geo_yrs)
        local_needs_resync = bool(local_invalid_geo_yrs)
        if (not skip_yearly or geo_yearly_needed or local_needs_resync) and geo_run:
            if drive_missing_geo_yrs and drive_gate:
                for yr in drive_missing_geo_yrs:
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
            if drive_missing_geo_yrs:
                add_tasks(
                    drive,
                    geojson_tasks.start_lst_y_geojson_tasks(
                        year_numbers=drive_missing_geo_yrs or None,
                        drive_gate=drive_gate,
                    ),
                )
                sync.update({"lst_geo_yearly_b", "lst_geo_yearly_m"})
                ran_derivative = True
            elif local_invalid_geo_yrs:
                sync.update({"lst_geo_yearly_b", "lst_geo_yearly_m"})
                ran_derivative = True
                messages.append(
                    "GeoJSON anuales LST válidos en Drive; re-descargando copia local sin re-export."
                )
        elif not geo_run:
            messages.append("Omitidos: GeoJSON anuales LST — sin datos faltantes/inválidos.")

    # --- Phase: SUHI (Surface Urban Heat Island) yearly GeoJSON ---
    if export_want(only, "suhi") or export_want(only, "geojson"):
        ic_suhi = vectors.lst_yearly_collection().filter(
            ee.Filter.gte("year", lst_asset_min_year())
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
            add_tasks(
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
