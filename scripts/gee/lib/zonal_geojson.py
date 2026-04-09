"""Exportación GeoJSON zonal mensual/anual parametrizable (reduceRegions)."""
from __future__ import annotations

import ee

from ..drive.drive_export_gate import DriveExportGate


def months_zonal_geojson_tasks(
    ic: ee.ImageCollection,
    *,
    source_band: str,
    value_property: str,
    stem_prefix: str,
    unidad_fc: ee.FeatureCollection,
    nombre_prefijo: str,
    drive_folder: str,
    selectores: list,
    scale_m: float,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """
    Para cada mes en la colección: mediana de ``source_band``, renombrada a ``value_property``.
    ``stem_prefix`` ej. ``AOD_Monthly_ZonalStats`` → ``AOD_Monthly_ZonalStats_Barrios_01``.
    """
    months_list = (
        ee.List(ic.aggregate_array("month")).distinct().sort().getInfo()
    )
    tasks: list[ee.batch.Task] = []
    if not months_list:
        return tasks

    for m in months_list:
        if month_numbers is not None and int(m) not in month_numbers:
            continue
        month_str = f"{int(m):02d}"
        stem = f"{stem_prefix}_{nombre_prefijo}_{month_str}"
        if drive_gate and drive_gate.should_skip_export(
            drive_folder,
            stem,
            (".geojson", ".json"),
        ):
            continue
        selected = ic.select(source_band).filter(ee.Filter.eq("month", m))
        median_img = selected.median().rename(value_property)
        image_return = ee.Image([median_img]).clip(unidad_fc).set("month", m)

        triplets = (
            image_return.addBands(ee.Image(1))
            .reduceRegions(collection=unidad_fc, reducer=ee.Reducer.mean(), scale=scale_m)
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


def yearly_zonal_geojson_tasks_last_year(
    ic: ee.ImageCollection,
    *,
    source_band: str,
    value_property: str,
    stem_prefix: str,
    last_year: int,
    unidad_fc: ee.FeatureCollection,
    nombre_prefijo: str,
    drive_folder: str,
    selectores: list,
    scale_m: float,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    tasks: list[ee.batch.Task] = []
    y = last_year
    stem = f"{stem_prefix}_{nombre_prefijo}_{y}"
    if drive_gate and drive_gate.should_skip_export(
        drive_folder,
        stem,
        (".geojson", ".json"),
    ):
        return tasks
    selected = ic.select(source_band).filter(ee.Filter.calendarRange(y, y, "year"))
    median_img = selected.median().rename(value_property)
    image_return = ee.Image([median_img]).clip(unidad_fc).set("year", y)
    triplets = (
        image_return.addBands(ee.Image(1))
        .reduceRegions(collection=unidad_fc, reducer=ee.Reducer.mean(), scale=scale_m)
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
    tasks.append(t)
    return tasks


def trend_zonal_geojson_tasks(
    sens_slope: ee.Image,
    p_value: ee.Image,
    *,
    barrios: ee.FeatureCollection,
    manzanas: ee.FeatureCollection,
    drive_folder_b: str,
    drive_folder_m: str,
    stem_b: str,
    stem_m: str,
    selectors_b: list,
    selectors_m: list,
    scale_m: float,
    drive_gate: DriveExportGate | None = None,
    p_max: float = 0.025,
) -> list[ee.batch.Task]:
    masked_slope = sens_slope.updateMask(p_value.lte(p_max))
    image_to_reduce = masked_slope.addBands(p_value)
    tasks: list[ee.batch.Task] = []

    fc_b = image_to_reduce.reduceRegions(
        collection=barrios, reducer=ee.Reducer.mean(), scale=scale_m
    ).map(lambda f: f.set("imageId", sens_slope.id()))

    fc_m = image_to_reduce.reduceRegions(
        collection=manzanas, reducer=ee.Reducer.mean(), scale=scale_m
    ).map(lambda f: f.set("imageId", sens_slope.id()))

    if not (
        drive_gate
        and drive_gate.should_skip_export(
            drive_folder_b,
            stem_b,
            (".geojson", ".json"),
        )
    ):
        t1 = ee.batch.Export.table.toDrive(
            collection=fc_b,
            description=stem_b,
            folder=drive_folder_b,
            fileNamePrefix=stem_b,
            fileFormat="GeoJSON",
            selectors=selectors_b,
        )
        t1.start()
        tasks.append(t1)

    if not (
        drive_gate
        and drive_gate.should_skip_export(
            drive_folder_m,
            stem_m,
            (".geojson", ".json"),
        )
    ):
        t2 = ee.batch.Export.table.toDrive(
            collection=fc_m,
            description=stem_m,
            folder=drive_folder_m,
            fileNamePrefix=stem_m,
            fileFormat="GeoJSON",
            selectors=selectors_m,
        )
        t2.start()
        tasks.append(t2)

    return tasks
