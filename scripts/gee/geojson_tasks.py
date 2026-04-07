"""
Exportación GeoJSON NDVI (traducción de NDVI_geojson.txt — API Python).

Tendencia multianual: Mann–Kendall + pendiente de Sen (espacial), misma lógica que el JS.
"""
from __future__ import annotations

import time

import ee

from . import mk_sen_trend
from . import paths
from . import vectors
from .drive_export_gate import DriveExportGate


def _months_geojson_tasks(
    s2_ym: ee.ImageCollection,
    unidad_fc: ee.FeatureCollection,
    nombre_prefijo: str,
    drive_folder: str,
    selectores: list,
    month_numbers: frozenset[int] | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    months_list = (
        ee.List(s2_ym.aggregate_array("month")).distinct().sort().getInfo()
    )
    tasks: list[ee.batch.Task] = []
    if not months_list:
        return tasks

    for m in months_list:
        if month_numbers is not None and int(m) not in month_numbers:
            continue
        month_str = f"{int(m):02d}"
        stem = f"NDVI_Monthly_ZonalStats_{nombre_prefijo}_{month_str}"
        if drive_gate and drive_gate.should_skip_export(
            drive_folder,
            stem,
            (".geojson", ".json"),
        ):
            continue
        selected = s2_ym.select("NDVI_median").filter(ee.Filter.eq("month", m))
        ndvi_median = selected.median().rename("NDVI")
        image_return = ee.Image([ndvi_median]).clip(unidad_fc).set("month", m)

        triplets = (
            image_return.addBands(ee.Image(1))
            .reduceRegions(collection=unidad_fc, reducer=ee.Reducer.mean(), scale=10)
            .map(lambda f: f.set({"imageId": image_return.id(), "Month": m}))
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
        tasks.append(t)
    return tasks


def start_ndvi_m_geojson_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    tasks = []
    tasks += _months_geojson_tasks(
        s2_ym,
        barrios,
        "Barrios",
        paths.DRIVE_GEO_MONTHLY_B,
        ["NOMBRE", "POBLACION", "Month", "NDVI", ".geo"],
        month_numbers=month_numbers,
        drive_gate=drive_gate,
    )
    tasks += _months_geojson_tasks(
        s2_ym,
        manzanas,
        "Manzanas",
        paths.DRIVE_GEO_MONTHLY_M,
        ["MANZENT", "TOTAL_PERS", "Month", "NDVI", ".geo"],
        month_numbers=month_numbers,
        drive_gate=drive_gate,
    )
    return tasks


def start_ndvi_y_geojson_tasks(
    s2_ym: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    s2_ym = s2_ym or vectors.ndvi_yearmonth_collection()
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()

    last_year = ee.Date(int(time.time() * 1000)).get("year").subtract(1).getInfo()
    years_list = [last_year]

    tasks: list[ee.batch.Task] = []

    def one_year(y: int, unidad_fc, prefijo: str, drive_folder: str, selectores: list):
        stem = f"NDVI_Yearly_ZonalStats_{prefijo}_{y}"
        if drive_gate and drive_gate.should_skip_export(
            drive_folder,
            stem,
            (".geojson", ".json"),
        ):
            return None
        selected = s2_ym.select("NDVI_median").filter(
            ee.Filter.calendarRange(y, y, "year")
        )
        ndvi_median = selected.median().rename("NDVI")
        image_return = ee.Image([ndvi_median]).clip(unidad_fc).set("year", y)
        triplets = (
            image_return.addBands(ee.Image(1))
            .reduceRegions(collection=unidad_fc, reducer=ee.Reducer.mean(), scale=10)
            .map(lambda f: f.set({"imageId": image_return.id(), "Year": y}))
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
        .reduceRegions(collection=areas_verdes, reducer=ee.Reducer.mean(), scale=10)
        .map(
            lambda f: f.set(
                {
                    "CATEGORIA": f.get("CATEGORIA"),
                    "AREA": f.get("AREA"),
                    "NDVI_SD": f.get("NDVI_SD"),
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
    image_to_reduce = sens_slope.addBands(p_value)

    fc_b = image_to_reduce.reduceRegions(
        collection=barrios, reducer=ee.Reducer.mean(), scale=10
    ).map(lambda f: f.set("imageId", sens_slope.id()))

    fc_m = image_to_reduce.reduceRegions(
        collection=manzanas, reducer=ee.Reducer.mean(), scale=10
    ).map(lambda f: f.set("imageId", sens_slope.id()))

    tasks = []
    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_GEO_TREND_B,
            "Trend_NDVI_ZonalStats_Barrios",
            (".geojson", ".json"),
        )
    ):
        t1 = ee.batch.Export.table.toDrive(
            collection=fc_b,
            description="Trend_NDVI_ZonalStats_Barrios",
            folder=paths.DRIVE_GEO_TREND_B,
            fileNamePrefix="Trend_NDVI_ZonalStats_Barrios",
            fileFormat="GeoJSON",
            selectors=["NOMBRE", "POBLACION", "slope_median", "p_value", ".geo"],
        )
        t1.start()
        tasks.append(t1)

    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_GEO_TREND_M,
            "Trend_NDVI_ZonalStats_Manzanas",
            (".geojson", ".json"),
        )
    ):
        t2 = ee.batch.Export.table.toDrive(
            collection=fc_m,
            description="Trend_NDVI_ZonalStats_Manzanas",
            folder=paths.DRIVE_GEO_TREND_M,
            fileNamePrefix="Trend_NDVI_ZonalStats_Manzanas",
            fileFormat="GeoJSON",
            selectors=["NOMBRE", "MANZENT", "TOTAL_PERS", "slope_median", "p_value", ".geo"],
        )
        t2.start()
        tasks.append(t2)

    if tasks:
        print("Tareas tendencia (Mann–Kendall + Sen) encoladas.")
    return tasks
