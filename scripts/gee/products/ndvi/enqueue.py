"""Encolar exportaciones NDVI (equivalente operativo a NDVI_export.txt)."""
from __future__ import annotations

from typing import Any

from ...drive.drive_audit import DriveFreshnessHints
from ...config.enqueue_types import EnqueueResult
from ...lib import yearmonth as ym_lib
from ...config import paths
from ...earth_engine_init import vectors
from . import csv_tasks
from . import geojson_tasks
from . import incremental
from . import raster_tasks


def _add_tasks(out: list[Any], items: list[Any] | Any | None) -> None:
    if items is None:
        return
    if isinstance(items, list):
        out.extend(t for t in items if t is not None)
    else:
        if items is not None:
            out.append(items)


def enqueue_ndvi_exports(
    *,
    only: set[str] | None,
    skip_yearly: bool,
    force_full: bool,
    drive_gate: Any | None = None,
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

    missing_assets = incremental.list_missing_ndvi_yearmonth_months()
    plan = incremental.plan_derivative_exports(
        missing_asset_months=missing_assets,
        force_full=force_full,
    )

    ic_for_year = vectors.ndvi_yearmonth_collection()
    last_calendar_year = ym_lib.effective_yearly_export_year(ic_for_year)
    force_yearly_csv = bool(
        drive_freshness and drive_freshness.yearly_csv_missing_or_stale
    )
    local_csv_needs_refresh = bool(
        drive_freshness and drive_freshness.local_csv_stale
    )
    force_yearly_geo = bool(
        drive_freshness and drive_freshness.yearly_geo_missing_or_stale
    )
    refresh_yearly_products = (
        plan.is_full_refresh
        or (last_calendar_year in plan.years_touched)
        or (tables_run_override is True)
        or force_yearly_csv
        or local_csv_needs_refresh
        or force_yearly_geo
    )
    csv_run = (
        (plan.run or force_yearly_csv or local_csv_needs_refresh)
        if tables_run_override is None
        else tables_run_override
    )
    geo_run = (
        (plan.run or force_yearly_geo)
        if tables_run_override is None
        else tables_run_override
    )
    tables_run = csv_run or geo_run

    if want("asset"):
        _add_tasks(asset, raster_tasks.start_ndvi_ym_asset_tasks())

    if want("raster"):
        ic_r = vectors.ndvi_yearmonth_collection()
        if missing_assets:
            messages.append(
                "[raster] Asset NDVI_YearMonth incompleto: omitidos tendencia, climatología "
                "mensual, anuales y SD a Drive hasta completar los assets."
            )
        else:
            lfy_tr = ym_lib.effective_yearly_export_year(ic_r)
            need_trend_year = incremental.should_refresh_trend_raster(ic_r)
            need_trend = plan.run or need_trend_year
            if need_trend:
                reason = (
                    "meses nuevos en el plan incremental"
                    if plan.run and not need_trend_year
                    else (
                        "año civil completo nuevo hasta "
                        f"{lfy_tr} (registro tendencia: "
                        f"{incremental.load_last_trend_raster_full_year()!s})"
                    )
                )
                messages.append(
                    f"[raster] Tendencia multianual ({reason}): "
                    f"Drive «{paths.DRIVE_RASTER_TREND}/NDVI_Yearly_Trend.tif» "
                    f"(no usar carpeta «{paths.DRIVE_RASTER_YEARLY}»)."
                )
                if need_trend_year and drive_gate:
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_RASTER_TREND,
                        stem_prefixes=("NDVI_Yearly_Trend",),
                    )
                tr_task = raster_tasks.start_ndvi_trend_raster_task(
                    drive_gate=drive_gate,
                    bypass_drive_gate=need_trend_year,
                )
                _add_tasks(drive, tr_task)
                if tr_task:
                    sync.add("raster_trend")
                    ran_derivative = True
                    incremental.save_last_trend_raster_full_year(
                        ym_lib.effective_yearly_export_year(ic_r)
                    )
                    sync_full_mirror.add("raster_trend")
            else:
                messages.append(
                    "[raster] Tendencia raster: sin recalculo (sin delta de meses nuevos y "
                    f"last_trend_raster_full_year ya en {lfy_tr})."
                )

            # --- Monthly climatology: only re-export when new source data ---
            run_monthly = plan.run or plan.is_full_refresh or force_full
            if run_monthly:
                full_refresh = plan.is_full_refresh or force_full
                month_filter = None if full_refresh else plan.month_subset
                if full_refresh and drive_gate:
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_RASTER_MONTHLY,
                        stem_prefixes=("NDVI_Monthly_",),
                        reason="refresco climatología mensual (datos nuevos en GEE)",
                    )
                monthly_tasks = raster_tasks.start_ndvi_monthly_climatology_tasks(
                    month_numbers=month_filter,
                    drive_gate=drive_gate,
                    bypass_drive_gate=full_refresh,
                )
                _add_tasks(drive, monthly_tasks)
                sync.add("raster_monthly")
                ran_derivative = True
                climatology_target = incremental.target_ym_for_monthly_climatology(ic_r)
                if full_refresh and climatology_target and monthly_tasks:
                    incremental.save_last_climatology_target_ym(climatology_target)
                if full_refresh and monthly_tasks:
                    sync_full_mirror.add("raster_monthly")
            else:
                messages.append(
                    "Omitidos: climatología mensual (sin meses nuevos en fuente GEE)."
                )
            if drive_freshness:
                sync_full_mirror |= set(drive_freshness.sync_full_mirror_extra_keys)

            # --- Yearly rasters: fill ALL missing years ---
            missing_raster_years = list(
                drive_freshness.missing_yearly_raster_years
            ) if drive_freshness else []
            yearly_needed = bool(missing_raster_years)
            if skip_yearly and not yearly_needed:
                messages.append(
                    "Omitido: raster anual y SD (--include-yearly para encolarlos)."
                )
            else:
                year_nums = missing_raster_years or None
                bypass_yr = bool(missing_raster_years)
                if bypass_yr and drive_gate:
                    for yr in missing_raster_years:
                        drive_gate.clear_before_reexport(
                            paths.DRIVE_RASTER_YEARLY,
                            file_stems=(f"NDVI_Yearly_{yr}",),
                            reason=f"falta año {yr} en Drive",
                        )
                _add_tasks(
                    drive,
                    raster_tasks.start_ndvi_yearly_raster_tasks(
                        year_numbers=year_nums,
                        drive_gate=drive_gate,
                        bypass_drive_gate=bypass_yr,
                    ),
                )
                sync.add("raster_yearly")
                ran_derivative = True

                if drive_gate:
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_RASTER_SD,
                        stem_prefixes=("NDVI_Monthly_StdDev",),
                    )
                _add_tasks(
                    drive,
                    raster_tasks.start_ndvi_sd_raster_task(drive_gate=drive_gate),
                )
                sync.add("raster_sd")
                ran_derivative = True

    local_stale_drive_ok = bool(
        drive_freshness and drive_freshness.local_tables_stale_drive_ok
    )

    if want("csv"):
        if csv_run and local_stale_drive_ok:
            sync.update({"csv", "csv_yearmonth"})
            ran_derivative = True
            messages.append(
                "CSV: Drive ya tiene versión reciente; descargando sin re-exportar."
            )
        elif csv_run:
            if drive_gate:
                drive_gate.clear_before_reexport(
                    paths.DRIVE_CSV_MONTHLY, extensions=(".csv",),
                    stem_prefixes=("NDVI_m_",),
                    reason="re-export CSV mensual",
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_CSV_YEARLY, extensions=(".csv",),
                    stem_prefixes=("NDVI_y_",),
                    reason="re-export CSV anual",
                )
            _add_tasks(drive, csv_tasks.start_ndvi_m_csv_tasks(drive_gate=drive_gate))
            _add_tasks(drive, csv_tasks.start_ndvi_ym_csv_tasks(drive_gate=drive_gate))
            sync.update({"csv", "csv_yearmonth"})
            ran_derivative = True
            if (
                plan.is_full_refresh
                or plan.years_touched
                or (tables_run_override is True)
                or force_yearly_csv
            ):
                _add_tasks(drive, csv_tasks.start_ndvi_y_csv_tasks(drive_gate=drive_gate))
            else:
                messages.append("Omitido: CSV anual (sin años nuevos en el delta).")
        else:
            messages.append("Omitidos: CSV — sin datos nuevos ni CSV inválidos.")

    if want("geojson"):
        drive_missing_geo_years = list(
            drive_freshness.drive_missing_yearly_geo_years
        ) if drive_freshness else []
        local_invalid_geo_years = list(
            drive_freshness.local_invalid_yearly_geo_years
        ) if drive_freshness else []
        geo_yearly_needed = bool(drive_missing_geo_years)

        local_needs_resync = bool(local_invalid_geo_years)
        if (not skip_yearly or geo_yearly_needed or local_needs_resync) and geo_run and refresh_yearly_products:
            if drive_missing_geo_years and drive_gate:
                for yr in drive_missing_geo_years:
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_GEO_YEARLY_B,
                        extensions=(".geojson", ".json"),
                        file_stems=(f"NDVI_Yearly_ZonalStats_Barrios_{yr}",),
                        reason=f"GeoJSON anual Barrios {yr} inválido/faltante — re-export",
                    )
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_GEO_YEARLY_M,
                        extensions=(".geojson", ".json"),
                        file_stems=(f"NDVI_Yearly_ZonalStats_Manzanas_{yr}",),
                        reason=f"GeoJSON anual Manzanas {yr} inválido/faltante — re-export",
                    )
            if drive_missing_geo_years:
                _add_tasks(
                    drive,
                    geojson_tasks.start_ndvi_y_geojson_tasks(
                        year_numbers=drive_missing_geo_years or None,
                        drive_gate=drive_gate,
                    ),
                )
                sync.update({"geo_yearly_b", "geo_yearly_m"})
                ran_derivative = True
            elif local_invalid_geo_years:
                sync.update({"geo_yearly_b", "geo_yearly_m"})
                ran_derivative = True
                messages.append(
                    "GeoJSON anuales NDVI válidos en Drive; re-descargando copia local sin re-export."
                )
        elif skip_yearly and not geo_yearly_needed and not local_needs_resync:
            messages.append(
                "Omitidos: GeoJSON anuales (zonal último año y NDVI_y_geojson; "
                "--include-yearly para encolarlos)."
            )
        elif not geo_run:
            messages.append("Omitidos: GeoJSON anuales — sin datos faltantes/inválidos.")

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
                    paths.DRIVE_GEO_MONTHLY_B,
                    extensions=(".geojson", ".json"),
                    file_stems=tuple(
                        f"NDVI_Monthly_ZonalStats_Barrios_{m:02d}"
                        for m in months_to_refresh
                    ),
                    reason="re-export GeoJSON mensual",
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_GEO_MONTHLY_M,
                    extensions=(".geojson", ".json"),
                    file_stems=tuple(
                        f"NDVI_Monthly_ZonalStats_Manzanas_{m:02d}"
                        for m in months_to_refresh
                    ),
                    reason="re-export GeoJSON mensual",
                )
            _add_tasks(
                drive,
                geojson_tasks.start_ndvi_m_geojson_tasks(
                    month_numbers=month_filter,
                    drive_gate=drive_gate,
                ),
            )
            _add_tasks(
                drive,
                geojson_tasks.start_ndvi_sd_av_geojson_task(drive_gate=drive_gate),
            )
            sync.update(
                {
                    "geo_monthly_b",
                    "geo_monthly_m",
                    "geo_sd_av",
                }
            )
            ran_derivative = True
        elif geo_run:
            messages.append(
                "Omitidos: GeoJSON mensuales (sin meses nuevos; solo anuales pendientes)."
            )
        else:
            messages.append("Omitidos: resto de GeoJSON — ver mensaje incremental.")

        need_trend_geo = plan.run or plan.is_full_refresh or force_full
        if need_trend_geo:
            if drive_gate:
                drive_gate.clear_before_reexport(
                    paths.DRIVE_GEO_TREND_B, extensions=(".geojson", ".json"),
                    stem_prefixes=("Trend_NDVI_ZonalStats_Barrios",),
                    reason="re-export GeoJSON tendencia",
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_GEO_TREND_M, extensions=(".geojson", ".json"),
                    stem_prefixes=("Trend_NDVI_ZonalStats_Manzanas",),
                    reason="re-export GeoJSON tendencia",
                )
            _add_tasks(
                drive,
                geojson_tasks.start_ndvi_t_geojson_tasks(drive_gate=drive_gate),
            )
            sync.update({"geo_trend_b", "geo_trend_m"})
            ran_derivative = True
        else:
            messages.append(
                "Omitidos: GeoJSON tendencia — sin datos nuevos en fuente GEE."
            )

    state_saved = False
    state_path_msg = ""
    if persist_state and plan.run and ran_derivative and plan.max_ym:
        incremental.save_last_processed_ym(plan.max_ym)
        state_saved = True
        state_path_msg = str(incremental.state_path())

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
