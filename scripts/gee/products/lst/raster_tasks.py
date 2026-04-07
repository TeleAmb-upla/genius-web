"""Rasters LST (scripts/LST_raster.txt)."""
from __future__ import annotations

import ee

from ... import paths
from ... import vectors
from ...drive_export_gate import DriveExportGate
from ...lib import mk_sen as mk_sen_lib
from ...lib import yearmonth as ym_lib
from . import incremental as lst_inc


def _cloud_mask(image: ee.Image) -> ee.Image:
    cirrus = 1 << 2
    clouds = 1 << 3
    cloudshadows = 1 << 4
    qa = image.select("QA_PIXEL")
    mask = (
        qa.bitwiseAnd(clouds).eq(0)
        .And(qa.bitwiseAnd(cloudshadows).eq(0))
        .And(qa.bitwiseAnd(cirrus).eq(0))
    )
    return image.updateMask(mask)


def _cloud_filter(image: ee.Image, gran: ee.FeatureCollection) -> ee.Image:
    quilpue_area = gran.geometry().area()
    qa = image.select("QA_PIXEL")
    land_mask = (
        qa.bitwiseAnd(1 << 3).eq(0)
        .And(qa.bitwiseAnd(1 << 4).eq(0))
        .And(qa.bitwiseAnd(1 << 2).eq(0))
    )
    area_land = land_mask.multiply(ee.Image.pixelArea())
    land_pixels = area_land.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=gran.geometry(),
        scale=30,
        maxPixels=1e9,
    )
    land_count = ee.Number(land_pixels.get("QA_PIXEL"))
    cloud_pct = land_count.divide(quilpue_area).multiply(-100).add(100)
    return image.set("cloud_percentage", cloud_pct)


def _thermal_celsius(image: ee.Image) -> ee.Image:
    thermal = (
        image.select("ST_B10").multiply(0.00341802).add(149.0).subtract(273.15).rename("ST_B101")
    )
    return image.addBands(thermal)


def start_lst_ym_asset_tasks() -> list[ee.batch.Task]:
    gran = vectors.gran_valparaiso()
    region = gran.geometry()
    missing = lst_inc.list_missing_lst_yearmonth_months()
    tasks: list[ee.batch.Task] = []
    if not missing:
        print("LST_YearMonth: sin huecos; no se encolan tareas.")
        return tasks
    print(f"LST_YearMonth: {len(missing)} meses a generar (solo asset).")

    l8 = (
        ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .select("ST_B10", "QA_PIXEL")
        .filterBounds(gran)
        .map(lambda im: _cloud_filter(ee.Image(im), gran))
        .map(_cloud_mask)
    )
    l9 = (
        ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
        .select("ST_B10", "QA_PIXEL")
        .filterBounds(gran)
        .map(lambda im: _cloud_filter(ee.Image(im), gran))
        .map(_cloud_mask)
    )
    landsat = l8.merge(l9).filter(ee.Filter.lte("cloud_percentage", 30)).map(_thermal_celsius)

    for y, m in missing:
        m_start = ee.Date.fromYMD(y, m, 1)
        m_end = m_start.advance(1, "month")
        filtered = landsat.select("ST_B101").filterDate(m_start, m_end)
        n = filtered.size().getInfo()
        if n == 0:
            print(f"  Aviso: sin Landsat LST para {y}-{m:02d}")
            continue
        lst_median = filtered.median().rename("LST_median")
        perc = filtered.reduce(
            ee.Reducer.percentile([0, 25, 75, 100], ["p0", "p25", "p75", "p100"])
        )
        lst_mean = filtered.mean().rename("LST_mean")
        lst_sd = filtered.reduce(ee.Reducer.stdDev()).rename("LST_SD")
        lst_count = filtered.count().rename("LST_count")
        image_return = (
            ee.Image([lst_median, perc, lst_mean, lst_count, lst_sd])
            .clip(gran)
            .set("year", y)
            .set("month", m)
            .set("system:time_start", ee.Date.fromYMD(y, m, 1).millis())
        )
        desc = f"LST_YearMonth_{y}_{m:02d}"
        t = ee.batch.Export.image.toAsset(
            image=image_return,
            description=desc,
            assetId=f"{paths.ASSET_LST_YEARMONTH}/{desc}",
            scale=30,
            region=region,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        t.start()
        tasks.append(t)
    return tasks


def start_lst_monthly_raster_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    ic = ic or vectors.lst_yearmonth_collection()
    urban = vectors.area_urbana_feature()
    ugeom = urban.geometry()
    tasks: list[ee.batch.Task] = []
    months_loop = (
        range(1, 13) if month_numbers is None else sorted(x for x in month_numbers if 1 <= x <= 12)
    )
    for m in months_loop:
        ms = f"{m:02d}"
        stem = f"LST_Monthly_{ms}"
        if (
            drive_gate
            and not bypass_drive_gate
            and drive_gate.should_skip_export(
                paths.DRIVE_LST_RASTER_MONTHLY,
                stem,
                (".tif", ".tiff"),
            )
        ):
            continue
        selected = (
            ic.select("LST_mean")
            .filter(ee.Filter.eq("month", m))
            .median()
            .rename("LST_mean")
        )
        t = ee.batch.Export.image.toDrive(
            image=selected.clip(ugeom),
            description=stem,
            folder=paths.DRIVE_LST_RASTER_MONTHLY,
            fileNamePrefix=stem,
            scale=30,
            region=ugeom,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        t.start()
        tasks.append(t)
    return tasks


def start_lst_yearly_raster_last_year_task(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> ee.batch.Task | None:
    ic = ic or vectors.lst_yearmonth_collection()
    urban = vectors.area_urbana_feature()
    ugeom = urban.geometry()
    y = ym_lib.effective_yearly_export_year(ic)
    stem = f"LST_Yearly_{y}"
    if (
        drive_gate
        and not bypass_drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_LST_RASTER_YEARLY,
            stem,
            (".tif", ".tiff"),
        )
    ):
        return None
    selected = (
        ic.select("LST_mean").filter(ee.Filter.eq("year", y)).median().rename("LST_mean")
    )
    t = ee.batch.Export.image.toDrive(
        image=selected.clip(ugeom),
        description=stem,
        folder=paths.DRIVE_LST_RASTER_YEARLY,
        fileNamePrefix=stem,
        scale=30,
        region=ugeom,
        crs="EPSG:4326",
        maxPixels=1e13,
    )
    t.start()
    return t


def start_lst_trend_raster_task(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> ee.batch.Task | None:
    ic = ic or vectors.lst_yearmonth_collection()
    urban = vectors.area_urbana_feature()
    ugeom = urban.geometry()
    stem = "LST_Yearly_Trend"
    if (
        drive_gate
        and not bypass_drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_LST_RASTER_YEARLY,
            stem,
            (".tif", ".tiff"),
        )
    ):
        return None
    trend = mk_sen_lib.mk_sen_raster_trend_masked_p(
        ic,
        ugeom,
        band_name="LST_mean",
        first_year_offset=1,
        p_max=0.025,
    )
    t = ee.batch.Export.image.toDrive(
        image=trend,
        description="LST_Yearly_Trend_export",
        folder=paths.DRIVE_LST_RASTER_YEARLY,
        fileNamePrefix=stem,
        scale=30,
        region=ugeom,
        crs="EPSG:4326",
        maxPixels=1e13,
    )
    t.start()
    return t
