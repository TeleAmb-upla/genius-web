"""CSV zonal AOD región (scripts/AOD_csv.txt)."""
from __future__ import annotations

import ee

from ....config import paths
from ....earth_engine_init import vectors
from ....drive.drive_export_gate import DriveExportGate
from ....lib import yearmonth as ym_lib


def _attach_aod_csv_props(feature: ee.Feature, time_key: str, time_value: object) -> ee.Feature:
    return ee.Feature(feature).set(time_key, time_value)


def start_aod_csv_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or vectors.aod_yearmonth_collection()
    region = vectors.region_valparaiso()
    tasks: list[ee.batch.Task] = []

    months = ee.List(ic.aggregate_array("month")).distinct().sort()
    aod_by_month = ee.ImageCollection.fromImages(
        months.map(
            lambda m: ee.Image(
                ic.select("AOD_median")
                .filter(ee.Filter.eq("month", m))
                .median()
                .rename("AOD_median")
            )
            .set("month", m)
            .clip(region)
        )
    )
    triplets_m = aod_by_month.map(
        lambda image: image.reduceRegions(
            collection=region,
            reducer=ee.Reducer.mean(),
            scale=1000,
        ).map(lambda f: _attach_aod_csv_props(f, "Month", image.get("month")))
    ).flatten()

    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_AOD_CSV_MONTHLY,
            "AOD_m_region",
            (".csv",),
        )
    ):
        t1 = ee.batch.Export.table.toDrive(
            collection=triplets_m,
            selectors=["Month", "AOD_median"],
            description="AOD_m_region",
            fileNamePrefix="AOD_m_region",
            folder=paths.DRIVE_AOD_CSV_MONTHLY,
            fileFormat="CSV",
        )
        t1.start()
        tasks.append(t1)

    max_export_year = ym_lib.last_completed_wall_clock_calendar_year()
    years = (
        ee.List(ic.aggregate_array("year")).distinct().sort()
        .filter(ee.Filter.lte("item", max_export_year))
    )
    aod_by_year = ee.ImageCollection.fromImages(
        years.map(
            lambda y: ee.Image(
                ic.select("AOD_median")
                .filter(ee.Filter.eq("year", y))
                .median()
                .rename("AOD_median")
            )
            .set("year", y)
            .clip(region)
        )
    )
    triplets_y = aod_by_year.map(
        lambda image: image.reduceRegions(
            collection=region,
            reducer=ee.Reducer.mean(),
            scale=1000,
        ).map(lambda f: _attach_aod_csv_props(f, "Year", image.get("year")))
    ).flatten()

    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_AOD_CSV_YEARLY,
            "AOD_y_region",
            (".csv",),
        )
    ):
        t2 = ee.batch.Export.table.toDrive(
            collection=triplets_y,
            selectors=["Year", "AOD_median"],
            description="AOD_y_region",
            fileNamePrefix="AOD_y_region",
            folder=paths.DRIVE_AOD_CSV_YEARLY,
            fileFormat="CSV",
        )
        t2.start()
        tasks.append(t2)

    return tasks
