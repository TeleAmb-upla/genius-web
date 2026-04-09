"""Encolar exportaciones AOD (paridad operativa con NDVI)."""
from __future__ import annotations

from typing import Any

from ....drive.drive_audit import DriveFreshnessHints
from ....config.enqueue_types import EnqueueResult
from ....drive.drive_export_gate import DriveExportGate
from ....config import paths
from ....lib import yearmonth as ym_lib
from . import csv_tasks
from . import geojson_tasks
from . import incremental as aod_inc
from . import raster_tasks


def _add_tasks(out: list[Any], items: list[Any] | Any | None) -> None:
    if items is None:
        return
    if isinstance(items, list):
        out.extend(t for t in items if t is not None)
    else:
        out.append(items)


def enqueue_aod_exports(
    *,
    only: set[str] | None,
    skip_yearly: bool,
    force_full: bool,
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

    missing = aod_inc.list_missing_aod_yearmonth_months()
    plan = aod_inc.plan_derivative_exports(
        missing_asset_months=missing,
        force_full=force_full,
    )

    if want("asset"):
        _add_tasks(asset, raster_tasks.start_aod_ym_asset_tasks())

    if want("raster"):
        if missing:
            messages.append(
                "[raster AOD] Asset AOD_YearMonth incompleto: omitidos derivados raster."
            )
        else:
            from ....earth_engine_init import vectors

            ic = vectors.aod_yearmonth_collection()
            if aod_inc.should_refresh_trend_raster(ic):
                if drive_gate:
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_AOD_RASTER_YEARLY,
                        stem_prefixes=("AOD_Yearly_Trend",),
                    )
                tr = raster_tasks.start_aod_trend_raster_task(
                    drive_gate=drive_gate,
                    bypass_drive_gate=True,
                )
                _add_tasks(drive, tr)
                if tr:
                    sync.add("aod_raster_trend")
                    ran_derivative = True
                    aod_inc.save_last_trend_raster_full_year(
                        ym_lib.effective_yearly_export_year(ic)
                    )

            # --- Yearly rasters: fill ALL missing years ---
            missing_raster_years = list(
                drive_freshness.missing_yearly_raster_years
            ) if drive_freshness else []
            yearly_needed = bool(missing_raster_years)
            if skip_yearly and not yearly_needed:
                messages.append(
                    "AOD: omitidos anuales (--include-yearly para encolarlos)."
                )
            else:
                year_nums = missing_raster_years or None
                bypass_yr = bool(missing_raster_years)
                if bypass_yr and drive_gate:
                    for yr in missing_raster_years:
                        drive_gate.clear_before_reexport(
                            paths.DRIVE_AOD_RASTER_YEARLY,
                            file_stems=(f"AOD_Yearly_{yr}",),
                            reason=f"falta año {yr} en Drive",
                        )
                _add_tasks(
                    drive,
                    raster_tasks.start_aod_yearly_raster_tasks(
                        year_numbers=year_nums,
                        drive_gate=drive_gate,
                        bypass_drive_gate=bypass_yr,
                    ),
                )
                sync.add("aod_raster_yearly")
                ran_derivative = True

            # --- Monthly climatology: only when new source data ---
            run_monthly = plan.run or plan.is_full_refresh or force_full
            if run_monthly:
                full_refresh = plan.is_full_refresh or force_full
                if full_refresh and drive_gate:
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_AOD_RASTER_MONTHLY,
                        stem_prefixes=("AOD_Monthly_",),
                        reason="refresco climatología mensual AOD (datos nuevos en GEE)",
                    )
                _add_tasks(
                    drive,
                    raster_tasks.start_aod_monthly_raster_tasks(
                        month_numbers=None if full_refresh else plan.month_subset,
                        drive_gate=drive_gate,
                        bypass_drive_gate=full_refresh,
                    ),
                )
                sync.add("aod_raster_monthly")
                ran_derivative = True
                if full_refresh:
                    sync_full_mirror.add("aod_raster_monthly")
            else:
                messages.append("[raster AOD] Climatología mensual: sin delta.")
            if drive_freshness:
                sync_full_mirror |= set(drive_freshness.sync_full_mirror_extra_keys)

    # --- Granular csv / geo separation ---
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
        sync.update({"aod_csv_monthly", "aod_csv_yearly"})
        ran_derivative = True
        messages.append(
            "CSV AOD: Drive ya tiene versión reciente; descargando sin re-exportar."
        )
    elif want("csv") and csv_run:
        if drive_gate:
            drive_gate.clear_before_reexport(
                paths.DRIVE_AOD_CSV_MONTHLY, extensions=(".csv",),
                stem_prefixes=("AOD_Monthly_Region",),
                reason="re-export CSV mensual AOD",
            )
            drive_gate.clear_before_reexport(
                paths.DRIVE_AOD_CSV_YEARLY, extensions=(".csv",),
                stem_prefixes=("AOD_Yearly_Region",),
                reason="re-export CSV anual AOD",
            )
        _add_tasks(drive, csv_tasks.start_aod_csv_tasks(drive_gate=drive_gate))
        sync.update({"aod_csv_monthly", "aod_csv_yearly"})
        ran_derivative = True
    elif want("csv"):
        messages.append("Omitidos CSV AOD — sin datos nuevos ni CSV inválidos.")

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
                    paths.DRIVE_AOD_GEO_MONTHLY_B,
                    extensions=(".geojson", ".json"),
                    file_stems=tuple(
                        f"AOD_Monthly_ZonalStats_Barrios_{m:02d}"
                        for m in months_to_refresh
                    ),
                    reason="re-export GeoJSON mensual AOD",
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_AOD_GEO_MONTHLY_M,
                    extensions=(".geojson", ".json"),
                    file_stems=tuple(
                        f"AOD_Monthly_ZonalStats_Manzanas_{m:02d}"
                        for m in months_to_refresh
                    ),
                    reason="re-export GeoJSON mensual AOD",
                )
            _add_tasks(
                drive,
                geojson_tasks.start_aod_m_geojson_tasks(
                    month_numbers=month_filter,
                    drive_gate=drive_gate,
                ),
            )
            sync.update({"aod_geo_monthly_b", "aod_geo_monthly_m"})
            ran_derivative = True
        elif tables_run:
            messages.append(
                "Omitidos: GeoJSON mensuales AOD (sin meses nuevos; solo tablas anuales pendientes)."
            )

        # Trend GeoJSON: ONLY when new source data, NOT when CSVs are stale
        need_trend_geo = plan.run or plan.is_full_refresh or force_full
        if need_trend_geo:
            if drive_gate:
                drive_gate.clear_before_reexport(
                    paths.DRIVE_AOD_GEO_TREND_B, extensions=(".geojson", ".json"),
                    stem_prefixes=("Trend_AOD_ZonalStats_Barrios",),
                    reason="re-export GeoJSON tendencia AOD",
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_AOD_GEO_TREND_M, extensions=(".geojson", ".json"),
                    stem_prefixes=("Trend_AOD_ZonalStats_Manzanas",),
                    reason="re-export GeoJSON tendencia AOD",
                )
            _add_tasks(
                drive,
                geojson_tasks.start_aod_t_geojson_tasks(drive_gate=drive_gate),
            )
            sync.update({"aod_geo_trend_b", "aod_geo_trend_m"})
            ran_derivative = True
        else:
            messages.append(
                "Omitidos: GeoJSON tendencia AOD — sin datos nuevos en fuente GEE."
            )

        # Yearly GeoJSON: only when geo files are missing/invalid
        missing_geo_yrs = list(
            drive_freshness.missing_yearly_geo_years
        ) if drive_freshness else []
        geo_yearly_needed = bool(missing_geo_yrs)
        if (not skip_yearly or geo_yearly_needed) and geo_run:
            if missing_geo_yrs and drive_gate:
                for yr in missing_geo_yrs:
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_AOD_GEO_YEARLY_B,
                        extensions=(".geojson", ".json"),
                        file_stems=(f"AOD_Yearly_ZonalStats_Barrios_{yr}",),
                        reason=f"GeoJSON anual Barrios {yr} inválido/faltante — re-export",
                    )
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_AOD_GEO_YEARLY_M,
                        extensions=(".geojson", ".json"),
                        file_stems=(f"AOD_Yearly_ZonalStats_Manzanas_{yr}",),
                        reason=f"GeoJSON anual Manzanas {yr} inválido/faltante — re-export",
                    )
            _add_tasks(
                drive,
                geojson_tasks.start_aod_y_geojson_tasks(
                    year_numbers=missing_geo_yrs or None,
                    drive_gate=drive_gate,
                ),
            )
            sync.update({"aod_geo_yearly_b", "aod_geo_yearly_m"})
            ran_derivative = True
        elif not geo_run and not run_monthly_geo:
            messages.append("Omitidos GeoJSON AOD — sin datos faltantes/inválidos.")

    state_saved = False
    state_path_msg = ""
    if persist_state and plan.run and ran_derivative and plan.max_ym:
        aod_inc.save_last_processed_ym(plan.max_ym)
        state_saved = True
        state_path_msg = str(aod_inc.state_path())

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
