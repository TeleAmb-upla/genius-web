"""
Exportación genérica de rasters (GeoTIFF, assets) para productos de EE.

Consolida el patrón repetido en:
- products/ndvi/raster_tasks.py
- products/lst/raster_tasks.py
- products/atmosphere/aod/raster_tasks.py
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Callable

import ee

from ..drive.drive_export_gate import DriveExportGate
from . import yearmonth as ym_lib


@dataclass
class RasterExportSpec:
    """Especificación para exportación de raster (asset o Drive)."""
    
    product_name: str
    """Nombre del producto (ej: 'NDVI', 'LST', 'AOD')"""
    
    asset_collection_path: str
    """Path del asset ImageCollection principal (ej: 'projects/.../NDVI_YearMonth')"""
    
    region: ee.FeatureCollection | ee.Geometry
    """Región para clip y export"""
    
    band_name: str
    """Nombre de la banda a exportar (ej: 'NDVI_median')"""
    
    source_ic: ee.ImageCollection | None = None
    """ImageCollection fuente (si None, se obtiene directamente del asset)"""
    
    drive_gate: DriveExportGate | None = None
    """Gate para verificar si ya existe en Drive"""
    
    scale: int = 30
    """Escala en metros (default: 30m Landsat)"""
    
    crs: str = "EPSG:4326"
    """Proyección de salida"""
    
    max_pixels: int = int(1e13)
    """Máximo de píxeles para export"""
    
    image_preprocessor: Callable[[ee.Image], ee.Image] | None = None
    """Función opcional para procesar cada imagen antes de exportar (ej: apply mask)"""


def export_monthly_rasters(
    spec: RasterExportSpec,
    *,
    months: list[int] | None = None,
    drive_folder: str,
    file_prefix_template: str = "{product}_Monthly_{month:02d}",
    export_to_asset: bool = False,
    asset_path_template: str | None = None,
) -> list[ee.batch.Task]:
    """
    Exporta rasters mensuales (climatologías o promedios mensuales).
    
    Args:
        spec: RasterExportSpec con IC, región, etc.
        months: meses a exportar (1-12), si None exporta todos disponibles
        drive_folder: carpeta Drive para exportar
        file_prefix_template: template para nombre (ej: "{product}_Monthly_{month:02d}")
        export_to_asset: si True, exporta a asset en lugar de Drive
        asset_path_template: template path del asset (si export_to_asset=True)
    
    Returns:
        Lista de tareas encoladas
    """
    tasks: list[ee.batch.Task] = []
    ic = spec.source_ic or ee.ImageCollection(spec.asset_collection_path)
    
    if months is None:
        months = list(range(1, 13))
    
    for month in months:
        # Filtrar imágenes del mes
        filtered = ic.select(spec.band_name).filter(ee.Filter.eq("month", month))
        
        if filtered.size().getInfo() == 0:
            continue
        
        # Agregar: median o mean según disponibilidad
        image = filtered.median().rename(spec.band_name)
        
        # Aplicar preprocessor (ej: mask)
        if spec.image_preprocessor:
            image = spec.image_preprocessor(image)
        
        # Preparar nombre de archivo
        name = file_prefix_template.format(product=spec.product_name, month=month)
        
        # Exportar
        if export_to_asset and asset_path_template:
            asset_id = asset_path_template.format(product=spec.product_name, month=month)
            task = ee.batch.Export.image.toAsset(
                image=image,
                description=f"{name}_asset",
                assetId=asset_id,
                scale=spec.scale,
                region=spec.region.geometry() if hasattr(spec.region, 'geometry') else spec.region,
                crs=spec.crs,
                maxPixels=spec.max_pixels,
            )
        else:
            if spec.drive_gate and spec.drive_gate.should_skip_export(
                drive_folder, name, (".tif", ".tiff")
            ):
                continue
            
            task = ee.batch.Export.image.toDrive(
                image=image,
                description=f"{name}_drive",
                folder=drive_folder,
                fileNamePrefix=name,
                scale=spec.scale,
                region=spec.region.geometry() if hasattr(spec.region, 'geometry') else spec.region,
                crs=spec.crs,
                maxPixels=spec.max_pixels,
                fileFormat="GeoTIFF",
            )
        
        task.start()
        tasks.append(task)
    
    return tasks


def export_yearly_rasters(
    spec: RasterExportSpec,
    *,
    years: list[int] | None = None,
    drive_folder: str,
    file_prefix_template: str = "{product}_Yearly_{year}",
    export_to_asset: bool = False,
    asset_path_template: str | None = None,
) -> list[ee.batch.Task]:
    """
    Exporta rasters anuales.
    
    Args:
        spec: RasterExportSpec
        years: años a exportar, si None obtiene de IC
        drive_folder: carpeta Drive
        file_prefix_template: template para nombre
        export_to_asset: si True, exporta a asset
        asset_path_template: template path del asset
    
    Returns:
        Lista de tareas encoladas
    """
    tasks: list[ee.batch.Task] = []
    ic = spec.source_ic or ee.ImageCollection(spec.asset_collection_path)
    
    if years is None:
        # Obtener años disponibles en IC
        years_list = ee.List(ic.aggregate_array("year")).distinct().sort()
        years = years_list.getInfo()
    
    for year in years:
        # Filtrar imágenes del año
        filtered = ic.select(spec.band_name).filter(ee.Filter.eq("year", year))
        
        if filtered.size().getInfo() == 0:
            continue
        
        # Agregar
        image = filtered.median().rename(spec.band_name)
        
        # Aplicar preprocessor
        if spec.image_preprocessor:
            image = spec.image_preprocessor(image)
        
        # Nombre de archivo
        name = file_prefix_template.format(product=spec.product_name, year=year)
        
        # Exportar
        if export_to_asset and asset_path_template:
            asset_id = asset_path_template.format(product=spec.product_name, year=year)
            task = ee.batch.Export.image.toAsset(
                image=image,
                description=f"{name}_asset",
                assetId=asset_id,
                scale=spec.scale,
                region=spec.region.geometry() if hasattr(spec.region, 'geometry') else spec.region,
                crs=spec.crs,
                maxPixels=spec.max_pixels,
            )
        else:
            if spec.drive_gate and spec.drive_gate.should_skip_export(
                drive_folder, name, (".tif", ".tiff")
            ):
                continue
            
            task = ee.batch.Export.image.toDrive(
                image=image,
                description=f"{name}_drive",
                folder=drive_folder,
                fileNamePrefix=name,
                scale=spec.scale,
                region=spec.region.geometry() if hasattr(spec.region, 'geometry') else spec.region,
                crs=spec.crs,
                maxPixels=spec.max_pixels,
                fileFormat="GeoTIFF",
            )
        
        task.start()
        tasks.append(task)
    
    return tasks


def export_trend_raster(
    spec: RasterExportSpec,
    trend_image: ee.Image,
    *,
    drive_folder: str,
    file_prefix: str = "Trend",
    export_to_asset: bool = False,
    asset_id: str | None = None,
) -> ee.batch.Task | None:
    """
    Exporta raster de tendencia (Mann-Kendall, Sen slope, etc).
    
    Args:
        spec: RasterExportSpec
        trend_image: imagen de tendencia (pre-calculada)
        drive_folder: carpeta Drive
        file_prefix: prefijo del archivo
        export_to_asset: si True, exporta a asset
        asset_id: path del asset (requerido si export_to_asset=True)
    
    Returns:
        Tarea encolada o None si fué skipped por drive_gate
    """
    # Verificar drive_gate
    if (not export_to_asset and spec.drive_gate and 
        spec.drive_gate.should_skip_export(drive_folder, file_prefix, (".tif", ".tiff"))):
        return None
    
    # Aplicar preprocessor si existe
    if spec.image_preprocessor:
        trend_image = spec.image_preprocessor(trend_image)
    
    # Exportar
    if export_to_asset:
        if not asset_id:
            raise ValueError("asset_id requerido cuando export_to_asset=True")
        
        task = ee.batch.Export.image.toAsset(
            image=trend_image,
            description=f"{file_prefix}_asset",
            assetId=asset_id,
            scale=spec.scale,
            region=spec.region.geometry() if hasattr(spec.region, 'geometry') else spec.region,
            crs=spec.crs,
            maxPixels=spec.max_pixels,
        )
    else:
        task = ee.batch.Export.image.toDrive(
            image=trend_image,
            description=f"{file_prefix}_drive",
            folder=drive_folder,
            fileNamePrefix=file_prefix,
            scale=spec.scale,
            region=spec.region.geometry() if hasattr(spec.region, 'geometry') else spec.region,
            crs=spec.crs,
            maxPixels=spec.max_pixels,
            fileFormat="GeoTIFF",
        )
    
    task.start()
    return task
