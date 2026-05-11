"""
Exportación GeoJSON NDVI (traducción de NDVI_geojson.txt — API Python).
Leer de arriba abajo (estilo Earth Engine Code Editor). API estable vía ``../geojson_tasks.py``.
"""
from __future__ import annotations

import time

import ee

from .. import mk_sen_trend
from ....config import paths
from ....earth_engine_init import vectors
from ....drive.drive_export_gate import DriveExportGate
from ....lib import unified_product_extraction as upe
from ....lib import yearmonth as ym_lib
from ....lib import zonal_geojson
from ....lib.zonal_geojson import _coalesce_zonal_median_scalar


def start_ndvi_m_geojson_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    return upe.monthly_zonal_geojson_barrios_manzanas(
        s2_ym,
        source_band="NDVI_median",
        value_property="NDVI",
        stem_prefix="NDVI_Monthly_ZonalStats",
        drive_folder_b=paths.DRIVE_GEO_MONTHLY_B,
        drive_folder_m=paths.DRIVE_GEO_MONTHLY_M,
        scale_m=10,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
    )


def start_ndvi_y_geojson_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()

    if year_numbers:
        years_list = sorted(year_numbers)
    else:
        years_list = [ym_lib.effective_yearly_export_year(s2_ym)]

    # Fetch year values directly from the collection to preserve their
    # original server-side type (avoids Python int vs GEE property mismatch).
    all_years_raw = (
        s2_ym.aggregate_array("year").distinct().sort().getInfo() or []
    )
    year_lookup: dict[int, object] = {int(y): y for y in all_years_raw}

    tasks: list[ee.batch.Task] = []

    def one_year(y: int, unidad_fc, prefijo: str, drive_folder: str, selectores: list):
        stem = f"NDVI_Yearly_ZonalStats_{prefijo}_{y}"
        if drive_gate and drive_gate.should_skip_export(
            drive_folder,
            stem,
            (".geojson", ".json"),
        ):
            return None
        orig_y = year_lookup.get(y, y)
        selected = s2_ym.select("NDVI_median").filter(
            ee.Filter.eq("year", orig_y)
        )
        n_images = selected.size().getInfo()
        if n_images == 0:
            print(
                f"  [WARN] Year {y}: 0 images with NDVI_median in collection "
                f"— skipping GeoJSON export ({prefijo})"
            )
            return None
        ndvi_median = selected.median().rename("NDVI")
        image_return = ee.Image([ndvi_median]).clip(unidad_fc).set("year", y)
        triplets = (
            image_return.addBands(ee.Image(1))
            .reduceRegions(collection=unidad_fc, reducer=ee.Reducer.median(), scale=10)
            .map(
                lambda f: _coalesce_zonal_median_scalar(ee.Feature(f), "NDVI").set(
                    {"imageId": image_return.id(), "Year": y}
                )
            )
        )
        t = ee.batch.Export.table.toDrive(
            collection=triplets,
            description=stem,
            folder=drive_folder,
            fileNamePrefix=stem,
            fileFormat="GeoJSON",
            selectors=selectores,
        )
        t.start()
        return t

    for y in years_list:
        tb = one_year(
            y,
            barrios,
            "Barrios",
            paths.DRIVE_GEO_YEARLY_B,
            ["NOMBRE", "POBLACION", "Year", "NDVI", ".geo"],
        )
        if tb is not None:
            tasks.append(tb)
        tm = one_year(
            y,
            manzanas,
            "Manzanas",
            paths.DRIVE_GEO_YEARLY_M,
            ["MANZENT", "TOTAL_PERS", "Year", "NDVI", ".geo"],
        )
        if tm is not None:
            tasks.append(tm)
    return tasks


def start_ndvi_sd_av_geojson_task(
    s2_ym: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> ee.batch.Task | None:
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    areas_verdes = vectors.areas_verdes()

    start_date = (
        ee.Date(int(time.time() * 1000)).advance(-2, "year").advance(-1, "month")
    )
    end_date = ee.Date(int(time.time() * 1000)).advance(-1, "month")
    recent_ndvi = s2_ym.filterDate(start_date, end_date)

    year_month_sd = (
        recent_ndvi.select("NDVI_median")
        .reduce(ee.Reducer.stdDev())
        .rename("NDVI_SD")
        .clip(areas_verdes)
    )

    triplets = (
        year_month_sd.addBands(ee.Image(1))
        .reduceRegions(collection=areas_verdes, reducer=ee.Reducer.median(), scale=10)
        .map(
            lambda f: _coalesce_zonal_median_scalar(ee.Feature(f), "NDVI_SD").set(
                {
                    "CATEGORIA": ee.Feature(f).get("CATEGORIA"),
                    "AREA": ee.Feature(f).get("AREA"),
                }
            )
        )
    )

    if drive_gate and drive_gate.should_skip_export(
        paths.DRIVE_GEO_SD_AV,
        "NDVI_SD_ZonalStats_av",
        (".geojson", ".json"),
    ):
        return None

    task = ee.batch.Export.table.toDrive(
        collection=triplets,
        folder=paths.DRIVE_GEO_SD_AV,
        selectors=["CATEGORIA", "AREA", "NDVI_SD", ".geo"],
        description="NDVI_SD_ZonalStats_av",
        fileNamePrefix="NDVI_SD_ZonalStats_av",
        fileFormat="GeoJSON",
    )
    task.start()
    return task


def start_ndvi_t_geojson_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()

    sens_slope, p_value = mk_sen_trend.mk_sen_slope_and_p_value(s2_ym)
    tasks = zonal_geojson.trend_zonal_geojson_tasks(
        sens_slope,
        p_value,
        barrios=barrios,
        manzanas=manzanas,
        drive_folder_b=paths.DRIVE_GEO_TREND_B,
        drive_folder_m=paths.DRIVE_GEO_TREND_M,
        stem_b="Trend_NDVI_ZonalStats_Barrios",
        stem_m="Trend_NDVI_ZonalStats_Manzanas",
        selectors_b=["NOMBRE", "POBLACION", "slope_median", "p_value", ".geo"],
        selectors_m=["NOMBRE", "MANZENT", "TOTAL_PERS", "slope_median", "p_value", ".geo"],
        scale_m=10,
        drive_gate=drive_gate,
    )
    if tasks:
        print("Tareas tendencia (Mann–Kendall + Sen) encoladas.")
    return tasks
