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
    refresh_yearly_products = (
        plan.is_full_refresh
        or (last_calendar_year in plan.years_touched)
        or (tables_run_override is True)
    )
    force_yearly_tables = bool(
        drive_freshness and drive_freshness.yearly_tables_missing_or_stale
    )
    tables_run = (
        (plan.run or force_yearly_tables)
        if tables_run_override is None
        else tables_run_override
    )

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

            max_ym = plan.max_ym or incremental.get_collection_max_ym(ic_r)
            climatology_target = incremental.target_ym_for_monthly_climatology(ic_r)
            refresh_by_state = incremental.should_refresh_monthly_climatology(ic_r)
            stale_mtime = (
                max_ym is not None
                and incremental.monthly_rasters_stale_vs_max_ym(max_ym)
            )
            stale_local_wall = ym_lib.monthly_local_rasters_stale_vs_last_completed_year(
                paths.REPO_RASTER_NDVI_MONTHLY, "NDVI_Monthly_"
            )
            drive_force_monthly = (
                drive_freshness.force_full_monthly_raster_export
                if drive_freshness
                else False
            )
            full_clim_refresh = (
                refresh_by_state
                or stale_mtime
                or stale_local_wall
                or drive_force_monthly
                or (plan.run and plan.is_full_refresh)
            )

            if full_clim_refresh and climatology_target:
                prev = incremental.load_last_climatology_target_ym()
                prev_s = (
                    f"{prev[0]}-{prev[1]:02d}" if prev else "(sin registro previo)"
                )
                messages.append(
                    "[raster] Climatología mensual NDVI_Monthly_*: serie hasta "
                    f"{climatology_target[0]}-{climatology_target[1]:02d} "
                    f"(último reexport guardado: {prev_s}); se encolan los 12 meses "
                    "y se omite pre-flight Drive para sustituir GeoTIFF en la carpeta."
                )
            elif stale_mtime and max_ym and not refresh_by_state:
                messages.append(
                    "[raster] Climatología mensual: también por mtime local vs colección "
                    f"(último mes en asset ~{max_ym[0]}-{max_ym[1]:02d})."
                )
            if stale_local_wall and not drive_force_monthly:
                messages.append(
                    "[raster] Climatología mensual: mtime local más reciente anterior al "
                    f"año civil cerrado {ym_lib.last_completed_wall_clock_calendar_year()}."
                )

            run_monthly = False
            month_filter: frozenset[int] | None = None
            bypass_monthly_gate = False
            if plan.run:
                run_monthly = True
                if full_clim_refresh:
                    month_filter = None
                    bypass_monthly_gate = True
                else:
                    month_filter = plan.month_subset
            elif full_clim_refresh:
                run_monthly = True
                month_filter = None
                bypass_monthly_gate = True

            if run_monthly:
                if bypass_monthly_gate and drive_gate:
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_RASTER_MONTHLY,
                        stem_prefixes=("NDVI_Monthly_",),
                    )
                monthly_tasks = raster_tasks.start_ndvi_monthly_climatology_tasks(
                    month_numbers=month_filter,
                    drive_gate=drive_gate,
                    bypass_drive_gate=bypass_monthly_gate,
                )
                _add_tasks(drive, monthly_tasks)
                sync.add("raster_monthly")
                ran_derivative = True
                if (
                    full_clim_refresh
                    and climatology_target
                    and monthly_tasks
                ):
                    incremental.save_last_climatology_target_ym(climatology_target)
                if full_clim_refresh and monthly_tasks:
                    sync_full_mirror.add("raster_monthly")
            else:
                messages.append(
                    "Omitidos: climatología mensual (sin meses nuevos en derivados ni refresco "
                    "por objetivo año-mes ni mtime local)."
                )
            if drive_freshness:
                sync_full_mirror |= set(drive_freshness.sync_full_mirror_extra_keys)

            yearly_needed = (
                drive_freshness is not None
                and drive_freshness.yearly_raster_missing_or_stale
            )
            if skip_yearly and not yearly_needed:
                messages.append(
                    "Omitido: raster anual y SD (--include-yearly para encolarlos)."
                )
            else:
                bypass_yr = bool(
                    drive_freshness and drive_freshness.yearly_raster_enqueue_bypass
                )
                if bypass_yr and drive_gate:
                    drive_gate.clear_before_reexport(
                        paths.DRIVE_RASTER_YEARLY,
                        stem_prefixes=("NDVI_Yearly_",),
                        stem_exclude_substrings=("Trend",),
                    )
                _add_tasks(
                    drive,
                    raster_tasks.start_ndvi_yearly_raster_tasks(
                        year_numbers=None,
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

    if want("csv"):
        if tables_run:
            if drive_gate:
                drive_gate.clear_before_reexport(
                    paths.DRIVE_CSV_MONTHLY, extensions=(".csv",),
                    stem_prefixes=("NDVI_m_",),
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_CSV_YEARLY, extensions=(".csv",),
                    stem_prefixes=("NDVI_y_",),
                )
            _add_tasks(drive, csv_tasks.start_ndvi_m_csv_tasks(drive_gate=drive_gate))
            _add_tasks(drive, csv_tasks.start_ndvi_ym_csv_tasks(drive_gate=drive_gate))
            sync.update({"csv", "csv_yearmonth"})
            ran_derivative = True
            if (
                plan.is_full_refresh
                or plan.years_touched
                or (tables_run_override is True)
            ):
                _add_tasks(drive, csv_tasks.start_ndvi_y_csv_tasks(drive_gate=drive_gate))
            else:
                messages.append("Omitido: CSV anual (sin años nuevos en el delta).")
        else:
            messages.append("Omitidos: CSV — ver mensaje incremental.")

    if want("geojson"):
        geo_yearly_needed = bool(
            drive_freshness
            and (
                drive_freshness.yearly_raster_missing_or_stale
                or drive_freshness.yearly_tables_missing_or_stale
            )
        )
        if (not skip_yearly or geo_yearly_needed) and tables_run and refresh_yearly_products:
            _add_tasks(
                drive,
                raster_tasks.start_ndvi_yearly_zonal_geojson_tasks(drive_gate=drive_gate),
            )
            _add_tasks(
                drive,
                geojson_tasks.start_ndvi_y_geojson_tasks(drive_gate=drive_gate),
            )
            sync.update({"geo_yearly_b", "geo_yearly_m"})
            ran_derivative = True
        elif (not skip_yearly or geo_yearly_needed) and tables_run:
            messages.append(
                "Omitidos: GeoJSON anuales zonales (sin actualización para el año "
                f"calendario {last_calendar_year})."
            )
        elif skip_yearly and not geo_yearly_needed:
            messages.append(
                "Omitidos: GeoJSON anuales (zonal último año y NDVI_y_geojson; "
                "--include-yearly para encolarlos)."
            )

        if tables_run:
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
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_GEO_MONTHLY_M,
                    extensions=(".geojson", ".json"),
                    file_stems=tuple(
                        f"NDVI_Monthly_ZonalStats_Manzanas_{m:02d}"
                        for m in months_to_refresh
                    ),
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
            if drive_gate:
                drive_gate.clear_before_reexport(
                    paths.DRIVE_GEO_TREND_B, extensions=(".geojson", ".json"),
                    stem_prefixes=("Trend_NDVI_ZonalStats_Barrios",),
                )
                drive_gate.clear_before_reexport(
                    paths.DRIVE_GEO_TREND_M, extensions=(".geojson", ".json"),
                    stem_prefixes=("Trend_NDVI_ZonalStats_Manzanas",),
                )
            _add_tasks(
                drive,
                geojson_tasks.start_ndvi_t_geojson_tasks(drive_gate=drive_gate),
            )
            sync.update(
                {
                    "geo_monthly_b",
                    "geo_monthly_m",
                    "geo_sd_av",
                    "geo_trend_b",
                    "geo_trend_m",
                }
            )
            ran_derivative = True
        else:
            messages.append("Omitidos: resto de GeoJSON — ver mensaje incremental.")

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
