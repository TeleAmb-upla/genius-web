"""Encolar exportaciones NO2 / SO2."""
from __future__ import annotations

from typing import Any

import ee

from ...drive.drive_audit import DriveFreshnessHints
from ...config.enqueue_types import EnqueueResult
from ...drive.drive_export_gate import DriveExportGate
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
            if tc.should_refresh_trend_raster(spec, ic):
                if drive_gate:
                    drive_gate.clear_before_reexport(
                        spec.drive_yearly,
                        stem_prefixes=(f"{spec.key.upper()}_Yearly_Trend",),
                    )
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

            # --- Yearly rasters: fill ALL missing years ---
            missing_raster_years = list(
                drive_freshness.missing_yearly_raster_years
            ) if drive_freshness else []
            yearly_needed = bool(missing_raster_years)
            if skip_yearly and not yearly_needed:
                messages.append(
                    f"{spec.key.upper()}: omitidos anuales (--include-yearly)."
                )
            else:
                year_nums = missing_raster_years or None
                bypass_yr = bool(missing_raster_years)
                if bypass_yr and drive_gate:
                    for yr in missing_raster_years:
                        drive_gate.clear_before_reexport(
                            spec.drive_yearly,
                            file_stems=(f"{spec.key.upper()}_Yearly_{yr}",),
                            reason=f"falta año {yr} en Drive",
                        )
                _add_tasks(
                    drive,
                    tc.start_yearly_raster_tasks(
                        spec,
                        year_numbers=year_nums,
                        drive_gate=drive_gate,
                        bypass_drive_gate=bypass_yr,
                    ),
                )
                sync.add(f"{sync_prefix}_raster_yearly")
                ran_derivative = True

            # --- Monthly climatology: only when new source data ---
            run_m = plan.run or plan.is_full_refresh or force_full
            if run_m:
                full_refresh = plan.is_full_refresh or force_full
                if full_refresh and drive_gate:
                    drive_gate.clear_before_reexport(
                        spec.drive_monthly,
                        stem_prefixes=(f"{spec.key.upper()}_Monthly_",),
                        reason=f"refresco climatología mensual {spec.key.upper()} (datos nuevos en GEE)",
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
            else:
                messages.append(
                    f"[raster {spec.key.upper()}] Climatología mensual: "
                    f"sin meses nuevos en fuente GEE."
                )
            if drive_freshness:
                sync_full_mirror |= set(drive_freshness.sync_full_mirror_extra_keys)

    # --- Granular csv / geo separation ---
    force_yearly_csv = bool(
        drive_freshness and drive_freshness.yearly_csv_missing_or_stale
    )
    local_csv_needs_refresh = bool(
        drive_freshness and drive_freshness.local_csv_stale
    )
    force_yearly_geo = bool(
        drive_freshness and drive_freshness.yearly_geo_missing_or_stale
    )
    csv_run = (
        (plan.run or plan.is_full_refresh or force_full or force_yearly_csv or local_csv_needs_refresh)
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
        sync.update(
            {f"{sync_prefix}_csv_monthly", f"{sync_prefix}_csv_yearly"}
        )
        ran_derivative = True
        messages.append(
            f"CSV {spec.key.upper()}: Drive ya tiene versión reciente; "
            f"descargando sin re-exportar."
        )
    elif want("csv") and csv_run:
        if drive_gate:
            drive_gate.clear_before_reexport(
                spec.drive_monthly, extensions=(".csv",),
                stem_prefixes=(f"{spec.key.upper()}_m_",),
                reason=f"re-export CSV mensual {spec.key.upper()}",
            )
            drive_gate.clear_before_reexport(
                spec.drive_yearly, extensions=(".csv",),
                stem_prefixes=(f"{spec.key.upper()}_y_",),
                reason=f"re-export CSV anual {spec.key.upper()}",
            )
        _add_tasks(drive, tc.start_csv_tasks(spec, drive_gate=drive_gate))
        sync.update(
            {f"{sync_prefix}_csv_monthly", f"{sync_prefix}_csv_yearly"}
        )
        ran_derivative = True
    elif want("csv"):
        messages.append(
            f"Omitidos CSV {spec.key.upper()} — sin datos nuevos ni CSV inválidos."
        )

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
                    spec.drive_geo_m_b,
                    extensions=(".geojson", ".json"),
                    file_stems=tuple(
                        f"{spec.key.upper()}_Monthly_ZonalStats_Barrios_{m:02d}"
                        for m in months_to_refresh
                    ),
                    reason=f"re-export GeoJSON mensual {spec.key.upper()}",
                )
                drive_gate.clear_before_reexport(
                    spec.drive_geo_m_m,
                    extensions=(".geojson", ".json"),
                    file_stems=tuple(
                        f"{spec.key.upper()}_Monthly_ZonalStats_Manzanas_{m:02d}"
                        for m in months_to_refresh
                    ),
                    reason=f"re-export GeoJSON mensual {spec.key.upper()}",
                )
            _add_tasks(
                drive,
                tc.start_m_geojson_tasks(
                    spec,
                    month_numbers=month_filter,
                    drive_gate=drive_gate,
                ),
            )
            sync.update(
                {
                    f"{sync_prefix}_geo_monthly_b",
                    f"{sync_prefix}_geo_monthly_m",
                }
            )
            ran_derivative = True
        elif tables_run:
            messages.append(
                f"Omitidos: GeoJSON mensuales {spec.key.upper()} "
                f"(sin meses nuevos; solo tablas anuales pendientes)."
            )

        # Trend GeoJSON: ONLY when new source data, NOT when CSVs are stale
        need_trend_geo = plan.run or plan.is_full_refresh or force_full
        if need_trend_geo:
            if drive_gate:
                drive_gate.clear_before_reexport(
                    spec.drive_geo_y_b, extensions=(".geojson", ".json"),
                    stem_prefixes=(spec.geo_trend_stem_b,),
                    reason=f"re-export GeoJSON tendencia {spec.key.upper()}",
                )
                drive_gate.clear_before_reexport(
                    spec.drive_geo_y_m, extensions=(".geojson", ".json"),
                    stem_prefixes=(spec.geo_trend_stem_m,),
                    reason=f"re-export GeoJSON tendencia {spec.key.upper()}",
                )
            _add_tasks(drive, tc.start_t_geojson_tasks(spec, drive_gate=drive_gate))
            sync.update(
                {
                    f"{sync_prefix}_geo_trend_b",
                    f"{sync_prefix}_geo_trend_m",
                }
            )
            ran_derivative = True
        else:
            messages.append(
                f"Omitidos: GeoJSON tendencia {spec.key.upper()} — "
                f"sin datos nuevos en fuente GEE."
            )

        # Yearly GeoJSON: only when geo files are missing/invalid
        drive_missing_geo_yrs = list(
            drive_freshness.drive_missing_yearly_geo_years
        ) if drive_freshness else []
        local_invalid_geo_yrs = list(
            drive_freshness.local_invalid_yearly_geo_years
        ) if drive_freshness else []
        full_refresh_geo_yrs: list[int] = []
        if (
            not skip_yearly
            and (force_full or plan.is_full_refresh)
            and not drive_missing_geo_yrs
            and not local_invalid_geo_yrs
        ):
            ic_for_years = ee.ImageCollection(spec.asset_ym)
            max_year = ym_lib.effective_yearly_export_year(ic_for_years)
            all_years_raw = (
                ic_for_years.aggregate_array("year").distinct().sort().getInfo() or []
            )
            full_refresh_geo_yrs = [
                int(y) for y in all_years_raw if int(y) <= max_year
            ]
        years_to_export = drive_missing_geo_yrs or full_refresh_geo_yrs
        geo_yearly_needed = bool(drive_missing_geo_yrs)
        local_needs_resync = bool(local_invalid_geo_yrs)
        if (not skip_yearly or geo_yearly_needed or local_needs_resync) and geo_run:
            if years_to_export and drive_gate:
                for yr in years_to_export:
                    drive_gate.clear_before_reexport(
                        spec.drive_geo_y_b, extensions=(".geojson", ".json"),
                        file_stems=(f"{spec.key.upper()}_Yearly_ZonalStats_Barrios_{yr}",),
                        reason=f"GeoJSON anual Barrios {yr} inválido/faltante — re-export",
                    )
                    drive_gate.clear_before_reexport(
                        spec.drive_geo_y_m, extensions=(".geojson", ".json"),
                        file_stems=(f"{spec.key.upper()}_Yearly_ZonalStats_Manzanas_{yr}",),
                        reason=f"GeoJSON anual Manzanas {yr} inválido/faltante — re-export",
                    )
            if years_to_export:
                _add_tasks(
                    drive,
                    tc.start_y_geojson_tasks(
                        spec,
                        year_numbers=years_to_export,
                        drive_gate=drive_gate,
                    ),
                )
                sync.update(
                    {
                        f"{sync_prefix}_geo_yearly_b",
                        f"{sync_prefix}_geo_yearly_m",
                    }
                )
                ran_derivative = True
            elif local_invalid_geo_yrs:
                sync.update(
                    {
                        f"{sync_prefix}_geo_yearly_b",
                        f"{sync_prefix}_geo_yearly_m",
                    }
                )
                ran_derivative = True
                messages.append(
                    f"GeoJSON anuales {spec.key.upper()} válidos en Drive; re-descargando copia local sin re-export."
                )
        elif not geo_run and not run_monthly_geo:
            messages.append(
                f"Omitidos GeoJSON {spec.key.upper()} — sin datos faltantes/inválidos."
            )

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
