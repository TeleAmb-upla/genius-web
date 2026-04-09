"""Exportaciones raster AOD (scripts/AOD_raster.txt)."""
from __future__ import annotations

import ee

from ....config import paths
from ....earth_engine_init import vectors
from ....drive.drive_export_gate import DriveExportGate
from ....lib import mk_sen as mk_sen_lib
from ....lib import yearmonth as ym_lib
from . import incremental as aod_inc


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
    tasks: list[ee.batch.Task] = []
    months_loop = (
        range(1, 13) if month_numbers is None else sorted(x for x in month_numbers if 1 <= x <= 12)
    )
    for m in months_loop:
        ms = f"{m:02d}"
        stem = f"AOD_Monthly_{ms}"
        if (
            drive_gate
            and not bypass_drive_gate
            and drive_gate.should_skip_export(
                paths.DRIVE_AOD_RASTER_MONTHLY,
                stem,
                (".tif", ".tiff"),
            )
        ):
            continue
        selected = ic.select("AOD_median").filter(ee.Filter.eq("month", m)).median()
        t = ee.batch.Export.image.toDrive(
            image=selected.clip(region),
            description=stem,
            folder=paths.DRIVE_AOD_RASTER_MONTHLY,
            fileNamePrefix=stem,
            scale=1000,
            region=geom,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        t.start()
        tasks.append(t)
    return tasks


def start_aod_yearly_raster_last_year_task(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> ee.batch.Task | None:
    """Un solo año: último año civil cerrado por reloj si el asset lo cubre; si no, último completo en colección."""
    ic = ic or vectors.aod_yearmonth_collection()
    region = vectors.region_valparaiso()
    geom = region.geometry()
    y = ym_lib.effective_yearly_export_year(ic)
    stem = f"AOD_Yearly_{y}"
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
    selected = ic.select("AOD_median").filter(ee.Filter.eq("year", y)).median()
    t = ee.batch.Export.image.toDrive(
        image=selected.clip(region),
        description=stem,
        folder=paths.DRIVE_AOD_RASTER_YEARLY,
        fileNamePrefix=stem,
        scale=1000,
        region=geom,
        crs="EPSG:4326",
        maxPixels=1e13,
    )
    t.start()
    return t


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
