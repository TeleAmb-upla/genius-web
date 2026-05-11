"""
Helpers y templates para orquestación de enqueue de productos.

Consolida patrones repetidos en productos/*/enqueue.py (filtro ``--only``, fase tablas).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any


def export_want(only: set[str] | None, name: str) -> bool:
    """True si hay que ejecutar la categoría *name* (asset / raster / csv / geojson / suhi)."""
    return only is None or name in only


@dataclass(frozen=True)
class TablesPhasePollutant:
    """Decisión común LST / AOD / NO2 / SO2: CSV y GeoJSON vs Drive frescura."""

    force_yearly_csv: bool
    clim_csv_needs_refresh: bool
    ym_csv_needs_refresh: bool
    force_yearly_geo: bool
    csv_run: bool
    ym_csv_download_only: bool
    geo_run: bool
    tables_run: bool
    local_stale_drive_ok: bool


def resolve_tables_phase_pollutant(
    plan: Any,
    *,
    force_full: bool,
    drive_freshness: Any | None,
    tables_run_override: bool | None,
) -> TablesPhasePollutant:
    """
    Misma lógica que comparten LST, AOD y ``atmosphere/enqueue._enqueue_s5p``:
    cuándo encolar CSV (incl. año-mes), cuándo solo descargar, cuándo GeoJSON.
    """
    force_yearly_csv = bool(
        drive_freshness and drive_freshness.yearly_csv_missing_or_stale
    )
    clim_csv_needs_refresh = bool(
        drive_freshness and drive_freshness.clim_csv_local_stale
    )
    ym_csv_needs_refresh = bool(
        drive_freshness and drive_freshness.yearmonth_csv_local_stale
    )
    force_yearly_geo = bool(
        drive_freshness and drive_freshness.yearly_geo_missing_or_stale
    )
    if tables_run_override is not None:
        csv_run = tables_run_override
        geo_run = tables_run_override
    else:
        csv_run = (
            plan.run
            or plan.is_full_refresh
            or force_full
            or force_yearly_csv
            or clim_csv_needs_refresh
        )
        geo_run = (
            plan.run or plan.is_full_refresh or force_full or force_yearly_geo
        )
    ym_csv_download_only = bool(ym_csv_needs_refresh and not csv_run)
    tables_run = csv_run or geo_run
    local_stale_drive_ok = bool(
        drive_freshness and drive_freshness.local_tables_stale_drive_ok
    )
    return TablesPhasePollutant(
        force_yearly_csv=force_yearly_csv,
        clim_csv_needs_refresh=clim_csv_needs_refresh,
        ym_csv_needs_refresh=ym_csv_needs_refresh,
        force_yearly_geo=force_yearly_geo,
        csv_run=csv_run,
        ym_csv_download_only=ym_csv_download_only,
        geo_run=geo_run,
        tables_run=tables_run,
        local_stale_drive_ok=local_stale_drive_ok,
    )


def resolve_tables_phase_ndvi(
    plan: Any,
    *,
    force_yearly_csv: bool,
    clim_csv_needs_refresh: bool,
    force_yearly_geo: bool,
    tables_run_override: bool | None,
) -> tuple[bool, bool, bool]:
    """Retorna ``(csv_run, geo_run, tables_run)`` — NDVI no usa el patrón año-mes solo-descarga."""
    if tables_run_override is not None:
        o = tables_run_override
        return o, o, o
    csv_run = plan.run or force_yearly_csv or clim_csv_needs_refresh
    geo_run = plan.run or force_yearly_geo
    return csv_run, geo_run, csv_run or geo_run


def add_tasks(
    out: list[Any],
    items: list[Any] | Any | None,
) -> None:
    """
    Agrega tareas a la lista de salida, manejando None, listas, objetos individuales.
    
    Args:
        out: lista de salida donde agregar tareas
        items: tareas a agregar (puede ser None, lista, o objeto individual)
    
    Uso:
        tasks = []
        add_tasks(tasks, csv_result)        # Si es None, no hace nada
        add_tasks(tasks, [t1, t2, None])   # Extiende y filtra None
        add_tasks(tasks, single_task)      # Agrega uno
    """
    if items is None:
        return
    if isinstance(items, list):
        out.extend(t for t in items if t is not None)
    else:
        if items is not None:
            out.append(items)


def collect_exports(
    *,
    asset_tasks: list[Any] | None = None,
    raster_tasks: list[Any] | None = None,
    csv_tasks: list[Any] | None = None,
    geojson_tasks: list[Any] | None = None,
) -> list[Any]:
    """
    Colecta todas las tareas encoladas de un producto en una sola lista.
    
    Args:
        asset_tasks: tareas de asset (ImageCollection)
        raster_tasks: tareas de raster (monthly/yearly/trend)
        csv_tasks: tareas de CSV
        geojson_tasks: tareas de GeoJSON
    
    Returns:
        Lista única de todas las tareas [Task, Task, ...]
    """
    all_tasks: list[Any] = []
    
    for tasks in [asset_tasks, raster_tasks, csv_tasks, geojson_tasks]:
        add_tasks(all_tasks, tasks)
    
    return all_tasks


def build_sync_keys(
    *,
    asset_exported: bool = False,
    raster_exported: bool = False,
    csv_exported: bool = False,
    geojson_exported: bool = False,
    product_name: str = "product",
) -> set[str]:
    """
    Construye set de claves de sincronización basado en qué fue exportado.
    
    Uso en pipeline.py para decidir qué carpetas sincronizar desde Drive.
    
    Args:
        asset_exported: si True, agrega "{product}_asset"
        raster_exported: si True, agrega "{product}_raster_*"
        csv_exported: si True, agrega "{product}_csv_*"
        geojson_exported: si True, agrega "{product}_geojson_*"
        product_name: nombre del producto para prefijo de claves
    
    Returns:
        set de claves de sincronización
    """
    sync_keys = set()
    
    if asset_exported:
        sync_keys.add(f"{product_name}_asset")
    if raster_exported:
        sync_keys.add(f"{product_name}_raster_monthly")
        sync_keys.add(f"{product_name}_raster_yearly")
        sync_keys.add(f"{product_name}_raster_trend")
    if csv_exported:
        sync_keys.add(f"{product_name}_csv_monthly")
        sync_keys.add(f"{product_name}_csv_yearly")
    if geojson_exported:
        sync_keys.add(f"{product_name}_geojson_monthly")
        sync_keys.add(f"{product_name}_geojson_yearly")
        sync_keys.add(f"{product_name}_geojson_trend")
    
    return sync_keys
