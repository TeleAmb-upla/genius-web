"""Rasters medianos (mensual climatológico / anual) desde ImageCollection año–mes — delega en ``unified_product_extraction``."""
from __future__ import annotations

import ee

from ..drive.drive_export_gate import DriveExportGate
from . import unified_product_extraction as upe


def start_monthly_climatology_raster_tasks(
    ic: ee.ImageCollection,
    *,
    source_band: str,
    scale: int,
    clip_region: ee.Geometry,
    drive_folder: str,
    stem_prefix: str,
    int16_quantize_divisor: int,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """
    Una mediana por mes calendario (1–12) sobre *ic*, cuantizada para web.

    ``stem_prefix``: p. ej. ``NDVI_Monthly`` → ``NDVI_Monthly_01`` … ``_12``.
    """
    return upe.monthly_climatology_raster_exports(
        ic,
        source_band=source_band,
        scale=float(scale),
        clip_region=clip_region,
        drive_folder=drive_folder,
        stem_prefix=stem_prefix,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
        finalize_median_image=upe.finalize_int16_scaled(
            source_band, int16_quantize_divisor
        ),
    )


def start_yearly_median_raster_tasks_from_yearmonth(
    ic: ee.ImageCollection,
    *,
    source_band: str,
    scale: int,
    clip_region: ee.Geometry,
    drive_folder: str,
    stem_prefix: str,
    int16_quantize_divisor: int,
    years_loop: list[int],
    year_lookup: dict[int, object] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """
    Una mediana por año civil sobre todas las imágenes *ic* con ese ``year``.

    ``stem_prefix``: p. ej. ``NDVI_Yearly`` → ``NDVI_Yearly_2019``.
    """
    return upe.yearly_median_raster_exports_from_yearmonth(
        ic,
        source_band=source_band,
        scale=float(scale),
        clip_region=clip_region,
        drive_folder=drive_folder,
        stem_prefix=stem_prefix,
        years_loop=years_loop,
        year_lookup=year_lookup,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
        finalize_median_image=upe.finalize_int16_scaled(
            source_band, int16_quantize_divisor
        ),
    )
