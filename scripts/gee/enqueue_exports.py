"""
Encola tareas de exportación NDVI en Earth Engine y devuelve las instancias Task
(para esperar su finalización antes de sincronizar Drive → repo).
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from typing import Any

from . import csv_tasks
from . import geojson_tasks
from . import incremental
from . import raster_tasks


@dataclass
class EnqueueResult:
    """Resultado de encolar exportaciones."""

    plan: incremental.DerivativePlan
    drive_tasks: list[Any] = field(default_factory=list)  # list[ee.batch.Task]
    asset_tasks: list[Any] = field(default_factory=list)
    sync_keys: set[str] = field(default_factory=set)
    ran_derivative: bool = False
    messages: list[str] = field(default_factory=list)
    state_saved: bool = False
    state_path_msg: str = ""


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
) -> EnqueueResult:
    """
    Encola exportaciones según el plan incremental.

    Args:
        only: None = todo; o subconjunto {'asset','raster','csv','geojson'}.
        skip_yearly: True si no se incluye --include-yearly.
        force_full: --force-full
        drive_gate: si se pasa, omite exports EE cuando el archivo ya existe en Drive.
    """
    drive: list[Any] = []
    asset: list[Any] = []
    sync: set[str] = set()
    messages: list[str] = []
    ran_derivative = False

    def want(name: str) -> bool:
        return only is None or name in only

    missing_assets = incremental.list_missing_ndvi_yearmonth_months()
    plan = incremental.plan_derivative_exports(
        missing_asset_months=missing_assets,
        force_full=force_full,
    )

    last_calendar_year = datetime.datetime.utcnow().year - 1
    refresh_yearly_products = plan.is_full_refresh or (
        last_calendar_year in plan.years_touched
    )

    if want("asset"):
        _add_tasks(asset, raster_tasks.start_ndvi_ym_asset_tasks())

    if want("raster"):
        if not skip_yearly and plan.run:
            _add_tasks(
                drive,
                raster_tasks.start_ndvi_trend_raster_task(drive_gate=drive_gate),
            )
            sync.add("raster_trend")
            ran_derivative = True
        elif not skip_yearly and not plan.run:
            messages.append(
                "Omitido: raster anual NDVI_Yearly_Trend (sin datos nuevos o asset incompleto)."
            )
        elif skip_yearly:
            messages.append(
                "Omitido: raster anual NDVI_Yearly_Trend (--include-yearly para encolarlo)."
            )

        if plan.run:
            month_filter = None if plan.is_full_refresh else plan.month_subset
            _add_tasks(
                drive,
                raster_tasks.start_ndvi_monthly_climatology_tasks(
                    month_numbers=month_filter,
                    drive_gate=drive_gate,
                ),
            )
            year_filter = None if plan.is_full_refresh else plan.years_touched
            _add_tasks(
                drive,
                raster_tasks.start_ndvi_yearly_raster_tasks(
                    year_numbers=year_filter,
                    drive_gate=drive_gate,
                ),
            )
            _add_tasks(
                drive,
                raster_tasks.start_ndvi_sd_raster_task(drive_gate=drive_gate),
            )
            sync.update({"raster_monthly", "raster_yearly", "raster_sd"})
            ran_derivative = True
        else:
            messages.append(
                "Omitidos: rasters derivados (climatología mensual, NDVI_Yearly y SD) — ver mensaje incremental."
            )

    if want("csv"):
        if plan.run:
            _add_tasks(drive, csv_tasks.start_ndvi_m_csv_tasks(drive_gate=drive_gate))
            _add_tasks(drive, csv_tasks.start_ndvi_ym_csv_tasks(drive_gate=drive_gate))
            sync.update({"csv", "csv_yearmonth"})
            ran_derivative = True
            if plan.is_full_refresh or plan.years_touched:
                _add_tasks(drive, csv_tasks.start_ndvi_y_csv_tasks(drive_gate=drive_gate))
            else:
                messages.append("Omitido: CSV anual (sin años nuevos en el delta).")
        else:
            messages.append("Omitidos: CSV — ver mensaje incremental.")

    if want("geojson"):
        if not skip_yearly and plan.run and refresh_yearly_products:
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
        elif not skip_yearly and plan.run:
            messages.append(
                "Omitidos: GeoJSON anuales zonales (sin actualización para el año "
                f"calendario {last_calendar_year})."
            )
        elif skip_yearly:
            messages.append(
                "Omitidos: GeoJSON anuales (zonal último año y NDVI_y_geojson; "
                "--include-yearly para encolarlos)."
            )

        if plan.run:
            month_filter = None if plan.is_full_refresh else plan.month_subset
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
    if plan.run and ran_derivative and plan.max_ym:
        incremental.save_last_processed_ym(plan.max_ym)
        state_saved = True
        state_path_msg = str(incremental.state_path())

    return EnqueueResult(
        plan=plan,
        drive_tasks=drive,
        asset_tasks=asset,
        sync_keys=sync,
        ran_derivative=ran_derivative,
        messages=messages,
        state_saved=state_saved,
        state_path_msg=state_path_msg,
    )
