"""
Exportación genérica de CSV con agregación temporal (monthly/yearly).

Consolida el patrón repetido en:
- products/ndvi/csv_tasks.py
- products/lst/csv_tasks.py
- products/atmosphere/aod/csv_tasks.py
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import ee

from ..drive.drive_export_gate import DriveExportGate


@dataclass
class CSVExportSpec:
    """Especificación para exportación CSV de un producto."""
    
    product_name: str
    """Nombre del producto (ej: 'NDVI', 'LST', 'AOD')"""
    
    ic: ee.ImageCollection
    """ImageCollection con bandas y metadatos year/month"""
    
    band_name: str
    """Nombre de la banda principal (ej: 'NDVI_median', 'LST_mean', 'AOD_median')"""
    
    region: ee.FeatureCollection | ee.Geometry
    """Región o geometría para reduceRegions"""
    
    time_periods: list[dict]
    """
    Lista de períodos temporales a exportar. Cada dict contiene:
    {
        'type': 'monthly' | 'yearly' | 'yearmonth',
        'folder': str (path Drive),
        'file_prefix': str,
        'description': str,
        'selectors': list[str],
        'export_config': dict opcional (reducer, scale, etc.)
    }
    """
    
    drive_gate: DriveExportGate | None = None
    """Gate paraverificar si ya existe en Drive (evita re-export)."""
    
    scale: int = 30
    """Escala para reduceRegions (default: 30m para Landsat)."""
    
    reducer: ee.Reducer | None = None
    """Reducer para estadísticas (default: ee.Reducer.mean())."""


def _aggregate_by_month(ic: ee.ImageCollection, band: str) -> ee.ImageCollection:
    """Agrega IC por mes civil."""
    months = ee.List(ic.aggregate_array("month")).distinct().sort()
    
    def month_image(m):
        m = ee.Number(m)
        selected = ic.select(band).filter(ee.Filter.eq("month", m))
        median = selected.median().rename(band)
        return median.set("month", m)
    
    return ee.ImageCollection.fromImages(months.map(month_image))


def _aggregate_by_year(ic: ee.ImageCollection, band: str) -> ee.ImageCollection:
    """Agrega IC por año civil."""
    years = ee.List(ic.aggregate_array("year")).distinct().sort()
    
    def year_image(y):
        y = ee.Number(y)
        selected = ic.select(band).filter(ee.Filter.eq("year", y))
        median = selected.median().rename(band)
        return median.set("year", y)
    
    return ee.ImageCollection.fromImages(years.map(year_image))


def export_csv_product(spec: CSVExportSpec) -> list[ee.batch.Task]:
    """
    Exporta CSV según especificación de períodos temporales.
    
    Args:
        spec: CSVExportSpec con IC, región, períodos, etc.
    
    Returns:
        Lista de tareas encoladas (ee.batch.Task)
    """
    tasks: list[ee.batch.Task] = []
    reducer = spec.reducer or ee.Reducer.mean()
    
    for period in spec.time_periods:
        period_type = period.get("type", "monthly")
        folder = period["folder"]
        file_prefix = period["file_prefix"]
        description = period["description"]
        selectors = period.get("selectors", [spec.band_name])
        scale = period.get("scale", spec.scale)
        
        # Validar si ya existe en Drive
        if (spec.drive_gate and 
            spec.drive_gate.should_skip_export(folder, file_prefix, (".csv",))):
            continue
        
        # Agregar temporal
        if period_type == "monthly":
            ic_agg = _aggregate_by_month(spec.ic, spec.band_name)
            time_field = "month"
            default_selectors = ["Month"] + selectors
        elif period_type == "yearly":
            ic_agg = _aggregate_by_year(spec.ic, spec.band_name)
            time_field = "year"
            default_selectors = ["Year"] + selectors
        elif period_type == "yearmonth":
            # Sin agregación, para series largas (año-mes en cada fila)
            ic_agg = spec.ic.select(spec.band_name)
            time_field = None
            default_selectors = selectors
        else:
            continue
        
        # reduceRegions y preparar tabla
        if time_field:
            def add_time_column(img):
                return img.reduceRegions(
                    collection=spec.region,
                    reducer=reducer,
                    scale=scale,
                ).map(lambda f: f.set(time_field.capitalize(), img.get(time_field)))
            
            table = ic_agg.map(add_time_column).flatten()
        else:
            # Para yearmonth sin agregación
            def reduce_with_ym(img):
                return img.reduceRegions(
                    collection=spec.region,
                    reducer=reducer,
                    scale=scale,
                ).map(lambda f: f.set("Year", img.get("year")).set("Month", img.get("month")))
            
            table = ic_agg.map(reduce_with_ym).flatten()
            default_selectors = ["Year", "Month"] + selectors
        
        # Exportar
        task = ee.batch.Export.table.toDrive(
            collection=table,
            description=description,
            folder=folder,
            fileNamePrefix=file_prefix,
            fileFormat="CSV",
            selectors=default_selectors,
        )
        task.start()
        tasks.append(task)
    
    return tasks
