"""
Exportaciones raster AOD (scripts/AOD_raster.txt).
Leer de arriba abajo (estilo Earth Engine Code Editor). API estable vía ``../raster_tasks.py``.
"""
from __future__ import annotations

import ee

from .....config import paths
from .....earth_engine_init import vectors
from .....drive.drive_export_gate import DriveExportGate
from .....lib import derivative_raster_export as dre
from .....lib import mk_sen as mk_sen_lib
from .....lib import yearmonth as ym_lib
from .....lib.raster_web_quantize import int16_scaled_band
from .. import incremental as aod_inc


def _mask_modis_aod(image: ee.Image) -> ee.Image:
    qa = image.select("AOD_QA")
    b8, b9, b10, b11 = (1 << 8), (1 << 9), (1 << 10), (1 << 11)
    mask = (
        qa.bitwiseAnd(b8).eq(0)
        .And(qa.bitwiseAnd(b9).eq(0))
        .And(qa.bitwiseAnd(b10).eq(0))
        .And(qa.bitwiseAnd(b11).eq(0))
    )
    return image.updateMask(mask)


def start_aod_ym_asset_tasks() -> list[ee.batch.Task]:
    region = vectors.region_valparaiso()
    geom = region.geometry()
    asset_base = paths.ASSET_AOD_YEARMONTH
    missing = aod_inc.list_missing_aod_yearmonth_months()
    tasks: list[ee.batch.Task] = []
    if not missing:
        print("AOD_YearMonth: sin huecos; no se encolan tareas.")
        return tasks
    print(f"AOD_YearMonth: {len(missing)} meses a generar (solo asset).")

    modis = (
        ee.ImageCollection("MODIS/061/MCD19A2_GRANULES")
        .filterBounds(region)
        .select(["Optical_Depth_047", "AOD_QA"])
        .map(lambda im: ee.Image(im).clip(region))
        .map(_mask_modis_aod)
    )

    for y, m in missing:
        m_start = ee.Date.fromYMD(y, m, 1)
        m_end = m_start.advance(1, "month")
        selected = modis.filterDate(m_start, m_end)
        n = selected.size().getInfo()
        if n == 0:
            print(f"  Aviso: sin imágenes MODIS AOD para {y}-{m:02d}")
            continue
        aod_median = selected.select("Optical_Depth_047").median().rename("AOD_median")
        image_return = (
            ee.Image([aod_median])
            .clip(region)
            .set("year", y)
            .set("month", m)
            .set("system:time_start", ee.Date.fromYMD(y, m, 1).millis())
        )
        desc = f"AOD_YearMonth_{y}_{m:02d}"
        t = ee.batch.Export.image.toAsset(
            image=image_return,
            description=desc,
            assetId=f"{asset_base}/{desc}",
            scale=1000,
            region=geom,
            maxPixels=1e13,
        )
        t.start()
        tasks.append(t)
    return tasks


def start_aod_monthly_raster_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    ic = ic or vectors.aod_yearmonth_collection()
    region = vectors.region_valparaiso()
    geom = region.geometry()
    return dre.start_monthly_climatology_raster_tasks(
        ic,
        source_band="AOD_median",
        scale=1000,
        clip_region=geom,
        drive_folder=paths.DRIVE_AOD_RASTER_MONTHLY,
        stem_prefix="AOD_Monthly",
        int16_quantize_divisor=100,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
    )


def start_aod_yearly_raster_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """
    Export AOD_Yearly_{YYYY}.tif for each year in *year_numbers*.
    When *year_numbers* is ``None``, exports only ``effective_yearly_export_year``.
    """
    ic = ic or vectors.aod_yearmonth_collection()
    region = vectors.region_valparaiso()
    geom = region.geometry()

    if year_numbers is None:
        years_loop = [ym_lib.effective_yearly_export_year(ic)]
    else:
        years_loop = sorted(year_numbers)

    all_years_raw = ic.aggregate_array("year").distinct().sort().getInfo() or []
    year_lookup: dict[int, object] = {int(y): y for y in all_years_raw}

    return dre.start_yearly_median_raster_tasks_from_yearmonth(
        ic,
        source_band="AOD_median",
        scale=1000,
        clip_region=geom,
        drive_folder=paths.DRIVE_AOD_RASTER_YEARLY,
        stem_prefix="AOD_Yearly",
        int16_quantize_divisor=100,
        years_loop=years_loop,
        year_lookup=year_lookup,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
    )


def start_aod_trend_raster_task(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> ee.batch.Task | None:
    """AOD_Yearly_Trend_Significant en carpeta AOD_Yearly (p<=0.025)."""
    ic = ic or vectors.aod_yearmonth_collection()
    region = vectors.region_valparaiso()
    geom = region.geometry()
    stem = "AOD_Yearly_Trend_Significant"
    if (
        drive_gate
        and not bypass_drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_AOD_RASTER_YEARLY,
            stem,
            (".tif", ".tiff"),
        )
    ):
        return None
    trend = mk_sen_lib.mk_sen_raster_trend_masked_p(
        ic,
        geom,
        band_name="AOD_median",
        first_year_offset=1,
        p_max=0.025,
    )
    trend = int16_scaled_band(trend, "trend", 10000)
    t = ee.batch.Export.image.toDrive(
        image=trend,
        description="AOD_Yearly_Trend_Significant_export",
        folder=paths.DRIVE_AOD_RASTER_YEARLY,
        fileNamePrefix=stem,
        scale=1000,
        region=geom,
        crs="EPSG:4326",
        maxPixels=1e13,
    )
    t.start()
    return t
