"""
Rasters LST desde ImageCollection ``LST_YearMonth`` en GEE.
Leer de arriba abajo (estilo Earth Engine Code Editor). API estable vía ``../raster_tasks.py``.
"""
from __future__ import annotations

import ee

from ....earth_engine_init import vectors
from ....lib import derivative_raster_export as dre
from ....lib import mk_sen as mk_sen_lib
from ....lib import yearmonth as ym_lib
from ....lib.raster_web_quantize import int16_scaled_band
from ....config import paths
from ....drive.drive_export_gate import DriveExportGate
from .. import incremental as lst_incremental
from ..asset_bounds import lst_asset_min_year
from ..constants import LST_NULL_SERIES_YEARS


# ---------------------------------------------------------------------------
# Landsat (solo export a Asset ``LST_YearMonth``)
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


def _thermal_celsius_tm(image: ee.Image) -> ee.Image:
    thermal = (
        image.select("ST_B6")
        .multiply(0.00341802)
        .add(149.0)
        .subtract(273.15)
        .rename("LST_mean")
    )
    return image.addBands(thermal)


def _build_lst_landsat_collection(region: ee.FeatureCollection) -> ee.ImageCollection:
    geom = region.geometry()
    l5 = (
        ee.ImageCollection("LANDSAT/LT05/C02/T1_L2")
        .select("ST_B6", "QA_PIXEL")
        .filterBounds(region)
        .map(lambda im: _cloud_filter(ee.Image(im), geom))
        .map(_cloud_mask)
    )
    l7 = (
        ee.ImageCollection("LANDSAT/LE07/C02/T1_L2")
        .select("ST_B6", "QA_PIXEL")
        .filterBounds(region)
        .map(lambda im: _cloud_filter(ee.Image(im), geom))
        .map(_cloud_mask)
    )
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
    legacy = (
        l5.merge(l7)
        .filter(ee.Filter.lte("cloud_percentage", 30))
        .map(_thermal_celsius_tm)
    )
    modern = (
        l8.merge(l9)
        .filter(ee.Filter.lte("cloud_percentage", 30))
        .map(_thermal_celsius)
    )
    return legacy.merge(modern)


def start_lst_yearmonth_asset_tasks() -> list[ee.batch.Task]:
    """
    Rellena huecos (año, mes) en ``users/.../LST/LST_YearMonth`` vía Landsat.
    Debe ejecutarse antes que derivados a Drive (el plan incremental lo exige).
    """
    asset_path = paths.ASSET_LST_YEARMONTH
    region_fc = vectors.lst_landsat_region_fc()
    region = region_fc.geometry()
    missing = lst_incremental.list_missing_lst_yearmonth_months()
    tasks: list[ee.batch.Task] = []
    if not missing:
        print("LST_YearMonth: sin huecos; no se encolan tareas de asset.")
        return tasks

    print(f"LST_YearMonth: {len(missing)} mes(es) a generar (export a Asset).")
    landsat = _build_lst_landsat_collection(region_fc).select("LST_mean")

    for y, m in missing:
        if y in LST_NULL_SERIES_YEARS:
            print(
                f"  Omitido asset LST_YearMonth {y}-{m:02d} "
                f"(año en LST_NULL_SERIES_YEARS — datos insuficientes / no usados en series)."
            )
            continue
        m_start = ee.Date.fromYMD(y, m, 1)
        m_end = m_start.advance(1, "month")
        filtered = landsat.filterDate(m_start, m_end)
        n = filtered.size().getInfo()
        if n == 0:
            print(f"  Aviso: sin Landsat LST para {y}-{m:02d} (no se crea imagen en asset).")
            continue
        composite = (
            filtered.median()
            .rename("LST_mean")
            .clip(region)
            .set("year", y)
            .set("month", m)
            .set("system:time_start", ee.Date.fromYMD(y, m, 1).millis())
        )
        desc = f"LST_YearMonth_{y}_{m:02d}"
        t = ee.batch.Export.image.toAsset(
            image=composite,
            description=desc,
            assetId=f"{asset_path}/{desc}",
            scale=30,
            region=region,
            crs="EPSG:4326",
            maxPixels=1e13,
        )
        t.start()
        tasks.append(t)
    return tasks


def start_lst_monthly_raster_tasks(
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """12 medianas climatológicas (una por mes) desde ``LST_YearMonth`` → Drive."""
    lo = lst_asset_min_year()
    ic_ym = (
        vectors.lst_yearmonth_collection()
        .filter(ee.Filter.gte("year", lo))
        .select("LST_mean")
    )
    ugeom = vectors.area_urbana_quilpue_feature().geometry()
    return dre.start_monthly_climatology_raster_tasks(
        ic_ym,
        source_band="LST_mean",
        scale=30,
        clip_region=ugeom,
        drive_folder=paths.DRIVE_LST_RASTER_MONTHLY,
        stem_prefix="LST_Monthly",
        int16_quantize_divisor=100,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
    )


def start_lst_yearly_raster_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """
    Export LST_Yearly_{YYYY}.tif (mediana año–mes por año civil, mismo criterio que la IC anual derivada).
    When *year_numbers* is ``None``, usa ``effective_yearly_export_year`` sobre ``LST_YearMonth`` (desde el mínimo del asset).
    """
    _ = ic  # Encolado pasa IC anual derivada por compatibilidad; TIFF anual desde año–mes.
    lo = lst_asset_min_year()
    ic_ym = (
        vectors.lst_yearmonth_collection()
        .filter(ee.Filter.gte("year", lo))
        .select("LST_mean")
    )
    ugeom = vectors.area_urbana_quilpue_feature().geometry()

    if year_numbers is None:
        ly_eff = ym_lib.effective_yearly_export_year(ic_ym)
        wall = ym_lib.last_completed_wall_clock_calendar_year()
        raw_years = ic_ym.aggregate_array("year").distinct().sort().getInfo() or []
        if not raw_years:
            return []
        max_y = max(int(y) for y in raw_years)
        y_export = min(ly_eff, max_y, wall)
        y_export = max(y_export, lo)
        years_loop = [y_export]
    else:
        years_loop = sorted(y for y in year_numbers if y >= lo)

    if not years_loop:
        return []

    all_years_raw = (
        ic_ym.aggregate_array("year").distinct().sort().getInfo() or []
    )
    year_lookup: dict[int, object] = {int(y): y for y in all_years_raw}

    return dre.start_yearly_median_raster_tasks_from_yearmonth(
        ic_ym,
        source_band="LST_mean",
        scale=30,
        clip_region=ugeom,
        drive_folder=paths.DRIVE_LST_RASTER_YEARLY,
        stem_prefix="LST_Yearly",
        int16_quantize_divisor=100,
        years_loop=years_loop,
        year_lookup=year_lookup,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
    )


def start_lst_trend_raster_task(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> ee.batch.Task | None:
    """Mann-Kendall / Sen trend from yearly series (derived) → Drive."""
    lo = lst_asset_min_year()
    ic = (ic or vectors.lst_yearly_collection()).filter(
        ee.Filter.gte("year", lo)
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
    trend = int16_scaled_band(trend, "trend", 10000)
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
