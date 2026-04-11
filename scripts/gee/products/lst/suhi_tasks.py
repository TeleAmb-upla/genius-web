"""
SUHI (Surface Urban Heat Island) yearly GeoJSON export.

For each year in the LST_Yearly asset collection, computes the heat island
intensity by comparing each pixel's LST with the spatial mean over the region,
then classifies into 4 classes:

    Clase 0: 0–3 °C  (low SUHI)
    Clase 1: 3–6 °C  (moderate)
    Clase 2: 6–9 °C  (strong)
    Clase 3: > 9 °C   (very strong)

Pixels cooler than the spatial mean are assigned Clase 0.
The classified raster is vectorised with ``reduceToVectors`` and exported as
GeoJSON to Drive.
"""
from __future__ import annotations

import ee

from ...config import paths
from ...earth_engine_init import vectors
from ...drive.drive_export_gate import DriveExportGate
from ...lib import yearmonth as ym_lib
from .constants import LST_START_YEAR


def _suhi_geojson_for_year(
    ic: ee.ImageCollection,
    year_val: object,
    year_int: int,
    region: ee.Geometry,
) -> ee.FeatureCollection:
    """Compute SUHI classification for a single year and return a FC."""
    img = (
        ic.select("LST_mean")
        .filter(ee.Filter.eq("year", year_val))
        .first()
        .rename("LST_mean")
    )

    cold_point = ee.Geometry.Point([-71.44578562504384, -33.01561128157486])
    pointstat = img.reduceRegion(
        reducer=ee.Reducer.mean(),
        geometry=cold_point,
        scale=30,
    )
    baseline = ee.Number(pointstat.get("LST_mean"))

    anomaly = img.subtract(baseline)

    classified = (
        ee.Image(0)
        .where(anomaly.gte(0).And(anomaly.lt(3)), 0)
        .where(anomaly.gte(3).And(anomaly.lt(6)), 1)
        .where(anomaly.gte(6).And(anomaly.lt(9)), 2)
        .where(anomaly.gte(9), 3)
        .rename("Clase")
        .toInt()
        .clip(region)
    )

    fc = classified.reduceToVectors(
        geometry=region,
        scale=30,
        geometryType="polygon",
        eightConnected=False,
        labelProperty="Clase",
        maxPixels=1e10,
    )

    return fc.map(lambda f: f.set("Year", year_int))


def start_lst_suhi_yearly_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """Export SUHI GeoJSON for each year in *year_numbers*."""
    ic = (ic or vectors.lst_yearly_collection()).filter(
        ee.Filter.gte("year", LST_START_YEAR)
    )
    region_fc = vectors.lst_landsat_region_fc()
    region = region_fc.geometry()

    all_years_raw = (
        ic.aggregate_array("year").distinct().sort().getInfo() or []
    )
    year_lookup: dict[int, object] = {int(y): y for y in all_years_raw}

    if year_numbers is None:
        max_y = ym_lib.get_collection_max_year(ic)
        if max_y is None:
            return []
        wall = ym_lib.last_completed_wall_clock_calendar_year()
        years_loop = [min(max_y, wall)]
    else:
        years_loop = sorted(y for y in year_numbers if y >= LST_START_YEAR)

    tasks: list[ee.batch.Task] = []
    for y in years_loop:
        stem = f"LST_SUHI_Yearly_{y}"
        if (
            drive_gate
            and not bypass_drive_gate
            and drive_gate.should_skip_export(
                paths.DRIVE_LST_SUHI_YEARLY, stem, (".geojson",)
            )
        ):
            continue

        orig_y = year_lookup.get(y, y)
        check = (
            ic.select("LST_mean")
            .filter(ee.Filter.eq("year", orig_y))
            .size()
            .getInfo()
        )
        if check == 0:
            print(f"  [WARN] SUHI year {y}: 0 images — skipping")
            continue

        fc = _suhi_geojson_for_year(ic, orig_y, y, region)
        t = ee.batch.Export.table.toDrive(
            collection=fc,
            description=stem,
            folder=paths.DRIVE_LST_SUHI_YEARLY,
            fileNamePrefix=stem,
            fileFormat="GeoJSON",
        )
        t.start()
        tasks.append(t)
        print(f"  [SUHI] Encolado: {stem}")

    return tasks
