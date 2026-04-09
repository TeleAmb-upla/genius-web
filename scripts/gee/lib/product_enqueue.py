"""
Helpers y templates para orquestación de enqueue de productos.

Consolida patrones repetidos en productos/enqueue.py para evitar duplicación.
"""
from __future__ import annotations

from typing import Any


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
