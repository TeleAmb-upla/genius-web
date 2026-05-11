"""Exportación GeoJSON zonal mensual/anual parametrizable (reduceRegions)."""
from __future__ import annotations

import ee
from typing import Callable

from ..drive.drive_export_gate import DriveExportGate


def _attach_value_property(
    feature: ee.Feature,
    value_property: str,
    time_key: str,
    time_value: object,
) -> ee.Feature:
    return ee.Feature(feature).set(time_key, time_value)


def _coalesce_zonal_median_scalar(feature: ee.Feature, prop: str) -> ee.Feature:
    """
    Tras ``reduceRegions(..., ee.Reducer.median())``, Earth Engine puede nombrar la
    propiedad ``{prop}_median`` o ``median``. Unifica a *prop* para los selectores
    de exportación (misma idea que los CSV zonal en ``unified_product_extraction``).
    """
    feat = ee.Feature(feature)
    names = feat.propertyNames()
    key_m = f"{prop}_median"
    key_mean = f"{prop}_mean"
    v = ee.Algorithms.If(
        names.contains(key_m),
        feat.get(key_m),
        ee.Algorithms.If(
            names.contains("median"),
            feat.get("median"),
            ee.Algorithms.If(
                names.contains(prop),
                feat.get(prop),
                ee.Algorithms.If(
                    names.contains(key_mean),
                    feat.get(key_mean),
                    ee.Algorithms.If(
                        names.contains("mean"), feat.get("mean"), None
                    ),
                ),
            ),
        ),
    )
    return feat.set(prop, v)


def _normalize_trend_zonal_features(feature: ee.Feature) -> ee.Feature:
    f = _coalesce_zonal_median_scalar(ee.Feature(feature), "slope_median")
    return _coalesce_zonal_median_scalar(f, "p_value")


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
    image_transform: Callable[[ee.Image], ee.Image] | None = None,
) -> list[ee.batch.Task]:
    """
    Para cada mes en la colección: mediana **temporal** de ``source_band``, renombrada a
    ``value_property``; agregación **espacial** por barrio/manzana con mediana de píxeles
    (``reduceRegions``), alineado a los CSV regionales y a la metodología del proyecto.
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
        median_img = selected.median()
        if image_transform is not None:
            median_img = image_transform(median_img)
        else:
            median_img = median_img.rename(value_property)
        image_return = ee.Image([median_img]).set("month", m)

        triplets = (
            image_return.addBands(ee.Image(1))
            .reduceRegions(
                collection=unidad_fc,
                reducer=ee.Reducer.median(),
                scale=scale_m,
                tileScale=4,
            )
            .map(
                lambda f: _attach_value_property(
                    _coalesce_zonal_median_scalar(ee.Feature(f), value_property).set(
                        "imageId", image_return.id()
                    ),
                    value_property,
                    "Month",
                    m,
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
        tasks.append(t)
    return tasks


def yearly_zonal_geojson_tasks_last_year(
    ic: ee.ImageCollection,
    *,
    source_band: str,
    value_property: str,
    stem_prefix: str,
    last_year: int,
    year_numbers: list[int] | None = None,
    unidad_fc: ee.FeatureCollection,
    nombre_prefijo: str,
    drive_folder: str,
    selectores: list,
    scale_m: float,
    drive_gate: DriveExportGate | None = None,
    image_transform: Callable[[ee.Image], ee.Image] | None = None,
) -> list[ee.batch.Task]:
    tasks: list[ee.batch.Task] = []
    years_loop = sorted(year_numbers) if year_numbers else [last_year]

    all_years_raw = (
        ic.aggregate_array("year").distinct().sort().getInfo() or []
    )
    year_lookup: dict[int, object] = {int(y): y for y in all_years_raw}

    for y in years_loop:
        y_int = int(y)
        stem = f"{stem_prefix}_{nombre_prefijo}_{y_int}"
        if drive_gate and drive_gate.should_skip_export(
            drive_folder,
            stem,
            (".geojson", ".json"),
        ):
            continue
        orig_y = year_lookup.get(y_int, y_int)
        try:
            y_filter = int(orig_y)
        except (TypeError, ValueError):
            y_filter = orig_y
        selected = ic.select(source_band).filter(ee.Filter.eq("year", y_filter))
        n_images = selected.size().getInfo()
        if n_images == 0:
            print(
                f"  [WARN] Year {y_int}: 0 images for band '{source_band}' "
                f"— skipping GeoJSON export ({nombre_prefijo})"
            )
            continue
        median_img = selected.median()
        if image_transform is not None:
            median_img = image_transform(median_img)
        else:
            median_img = median_img.rename(value_property)
        image_return = ee.Image([median_img]).set("year", y_int)
        triplets = (
            image_return.addBands(ee.Image(1))
            .reduceRegions(
                collection=unidad_fc,
                reducer=ee.Reducer.median(),
                scale=scale_m,
                tileScale=4,
            )
            .map(
                lambda f: _attach_value_property(
                    _coalesce_zonal_median_scalar(ee.Feature(f), value_property).set(
                        "imageId", image_return.id()
                    ),
                    value_property,
                    "Year",
                    y_int,
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
        collection=barrios,
        reducer=ee.Reducer.median(),
        scale=scale_m,
        tileScale=4,
    ).map(
        lambda f: _normalize_trend_zonal_features(
            ee.Feature(f).set("imageId", sens_slope.id())
        )
    )

    fc_m = image_to_reduce.reduceRegions(
        collection=manzanas,
        reducer=ee.Reducer.median(),
        scale=scale_m,
        tileScale=4,
    ).map(
        lambda f: _normalize_trend_zonal_features(
            ee.Feature(f).set("imageId", sens_slope.id())
        )
    )

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
