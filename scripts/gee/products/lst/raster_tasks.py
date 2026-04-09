"""
Rasters LST desde Landsat L8+L9.

- Asset anual (LST_Yearly): un compuesto por año → export toAsset.
- Climatología mensual: directo desde Landsat → export toDrive (sin asset intermedio).
- Trend raster: desde asset LST_Yearly → toDrive.
"""
from __future__ import annotations

import ee

from ...config import paths
from ...earth_engine_init import vectors
from ...drive.drive_export_gate import DriveExportGate
from ...lib import mk_sen as mk_sen_lib
from ...lib import yearmonth as ym_lib
from .constants import LST_START_YEAR


# ---------------------------------------------------------------------------
# Landsat helpers (cloud mask, thermal conversion)
# ---------------------------------------------------------------------------

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


def _cloud_filter(image: ee.Image, geom: ee.Geometry) -> ee.Image:
    total_area = geom.area()
    qa = image.select("QA_PIXEL")
    land_mask = (
        qa.bitwiseAnd(1 << 3).eq(0)
        .And(qa.bitwiseAnd(1 << 4).eq(0))
        .And(qa.bitwiseAnd(1 << 2).eq(0))
    )
    area_land = land_mask.multiply(ee.Image.pixelArea())
    land_pixels = area_land.reduceRegion(
        reducer=ee.Reducer.sum(),
        geometry=geom,
        scale=30,
        maxPixels=1e9,
    )
    land_count = ee.Number(land_pixels.get("QA_PIXEL"))
    cloud_pct = land_count.divide(total_area).multiply(-100).add(100)
    return image.set("cloud_percentage", cloud_pct)


def _thermal_celsius(image: ee.Image) -> ee.Image:
    thermal = (
        image.select("ST_B10")
        .multiply(0.00341802)
        .add(149.0)
        .subtract(273.15)
        .rename("LST_mean")
    )
    return image.addBands(thermal)


def _build_lst_landsat_collection(
    region: ee.FeatureCollection,
) -> ee.ImageCollection:
    """Merged Landsat 8+9, cloud-filtered, with band ``LST_mean`` in Celsius."""
    geom = region.geometry()
    l8 = (
        ee.ImageCollection("LANDSAT/LC08/C02/T1_L2")
        .select("ST_B10", "QA_PIXEL")
        .filterBounds(region)
        .map(lambda im: _cloud_filter(ee.Image(im), geom))
        .map(_cloud_mask)
    )
    l9 = (
        ee.ImageCollection("LANDSAT/LC09/C02/T1_L2")
        .select("ST_B10", "QA_PIXEL")
        .filterBounds(region)
        .map(lambda im: _cloud_filter(ee.Image(im), geom))
        .map(_cloud_mask)
    )
    return (
        l8.merge(l9)
        .filter(ee.Filter.lte("cloud_percentage", 30))
        .map(_thermal_celsius)
    )


# ---------------------------------------------------------------------------
# Yearly assets (LST_Yearly)
# ---------------------------------------------------------------------------

def start_lst_yearly_asset_tasks(
    missing_years: list[int] | None = None,
) -> list[ee.batch.Task]:
    """Export annual medians to the ``LST_Yearly`` asset collection."""
    region_fc = vectors.lst_landsat_region_fc()
    region = region_fc.geometry()

    if missing_years is None:
        missing_years = ym_lib.list_missing_yearly(
            paths.ASSET_LST_YEARLY,
            start_year=LST_START_YEAR,
        )

    tasks: list[ee.batch.Task] = []
    if not missing_years:
        print("LST_Yearly: sin años faltantes; no se encolan tareas de asset.")
        return tasks
    print(f"LST_Yearly: {len(missing_years)} año(s) a generar como asset.")

    landsat = _build_lst_landsat_collection(region_fc)

    for y in missing_years:
        y_start = ee.Date.fromYMD(y, 1, 1)
        y_end = ee.Date.fromYMD(y + 1, 1, 1)
        filtered = landsat.select("LST_mean").filterDate(y_start, y_end)
        n = filtered.size().getInfo()
        if n == 0:
            print(f"  Aviso: sin Landsat LST para {y}")
            continue
        annual_median = (
            filtered.median()
            .rename("LST_mean")
            .clip(region)
            .set("year", y)
            .set("system:time_start", y_start.millis())
        )
        desc = f"LST_Yearly_{y}"
        t = ee.batch.Export.image.toAsset(
            image=annual_median,
            description=desc,
            assetId=f"{paths.ASSET_LST_YEARLY}/{desc}",
            scale=30,
            region=region,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        t.start()
        tasks.append(t)
    return tasks


# ---------------------------------------------------------------------------
# Monthly climatology rasters (direct Landsat → Drive, no asset)
# ---------------------------------------------------------------------------

def start_lst_monthly_raster_tasks(
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """12 monthly climatology medians computed on-the-fly from Landsat → Drive."""
    region_fc = vectors.lst_landsat_region_fc()
    ugeom = vectors.area_urbana_quilpue_feature().geometry()
    landsat = _build_lst_landsat_collection(region_fc).select("LST_mean")
    tasks: list[ee.batch.Task] = []
    months_loop = (
        range(1, 13)
        if month_numbers is None
        else sorted(x for x in month_numbers if 1 <= x <= 12)
    )
    for m in months_loop:
        ms = f"{m:02d}"
        stem = f"LST_Monthly_{ms}"
        if (
            drive_gate
            and not bypass_drive_gate
            and drive_gate.should_skip_export(
                paths.DRIVE_LST_RASTER_MONTHLY, stem, (".tif", ".tiff")
            )
        ):
            continue
        m_filter = ee.Filter.calendarRange(m, m, "month")
        selected = landsat.filter(m_filter).median().rename("LST_mean")
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


# ---------------------------------------------------------------------------
# Yearly raster to Drive (from asset LST_Yearly)
# ---------------------------------------------------------------------------

def start_lst_yearly_raster_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """
    Export LST_Yearly_{YYYY}.tif for each year in *year_numbers*.
    When *year_numbers* is ``None``, exports only the effective yearly year.
    """
    ic = (ic or vectors.lst_yearly_collection()).filter(
        ee.Filter.gte("year", LST_START_YEAR)
    )
    ugeom = vectors.area_urbana_quilpue_feature().geometry()
    tasks: list[ee.batch.Task] = []

    if year_numbers is None:
        max_y = ym_lib.get_collection_max_year(ic)
        if max_y is None:
            return tasks
        wall = ym_lib.last_completed_wall_clock_calendar_year()
        years_loop = [min(max_y, wall)]
    else:
        years_loop = sorted(y for y in year_numbers if y >= LST_START_YEAR)

    all_years_raw = (
        ic.aggregate_array("year").distinct().sort().getInfo() or []
    )
    year_lookup: dict[int, object] = {int(y): y for y in all_years_raw}

    for y in years_loop:
        stem = f"LST_Yearly_{y}"
        if (
            drive_gate
            and not bypass_drive_gate
            and drive_gate.should_skip_export(
                paths.DRIVE_LST_RASTER_YEARLY, stem, (".tif", ".tiff"),
            )
        ):
            continue
        orig_y = year_lookup.get(y, y)
        selected = (
            ic.select("LST_mean")
            .filter(ee.Filter.eq("year", orig_y))
            .first()
            .rename("LST_mean")
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
        tasks.append(t)
    return tasks


# ---------------------------------------------------------------------------
# Trend raster (from asset LST_Yearly → Drive)
# ---------------------------------------------------------------------------

def start_lst_trend_raster_task(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> ee.batch.Task | None:
    """Mann-Kendall / Sen trend from yearly asset → Drive."""
    ic = (ic or vectors.lst_yearly_collection()).filter(
        ee.Filter.gte("year", LST_START_YEAR)
    )
    ugeom = vectors.area_urbana_quilpue_feature().geometry()
    stem = "LST_Yearly_Trend"
    if (
        drive_gate
        and not bypass_drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_LST_RASTER_YEARLY, stem, (".tif", ".tiff")
        )
    ):
        return None
    trend = mk_sen_lib.mk_sen_raster_trend_masked_p_annual(
        ic,
        ugeom,
        "LST_mean",
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
