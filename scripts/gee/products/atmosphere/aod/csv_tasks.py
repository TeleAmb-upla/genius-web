"""CSV zonal AOD región (scripts/AOD_csv.txt)."""
from __future__ import annotations

import ee

from .... import paths
from .... import vectors
from ....drive_export_gate import DriveExportGate


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
        ).map(lambda f: f.set("Month", image.get("month")))
    ).flatten()

    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_AOD_CSV_MONTHLY,
            "AOD_Monthly_Region",
            (".csv",),
        )
    ):
        t1 = ee.batch.Export.table.toDrive(
            collection=triplets_m,
            selectors=["Month", "AOD_median"],
            description="AOD_Monthly_Region",
            fileNamePrefix="AOD_Monthly_Region",
            folder=paths.DRIVE_AOD_CSV_MONTHLY,
            fileFormat="CSV",
        )
        t1.start()
        tasks.append(t1)

    years = ee.List(ic.aggregate_array("year")).distinct().sort()
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
        ).map(lambda f: f.set("Year", image.get("year")))
    ).flatten()

    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_AOD_CSV_YEARLY,
            "AOD_Yearly_Region",
            (".csv",),
        )
    ):
        t2 = ee.batch.Export.table.toDrive(
            collection=triplets_y,
            selectors=["Year", "AOD_median"],
            description="AOD_Yearly_Region",
            fileNamePrefix="AOD_Yearly_Region",
            folder=paths.DRIVE_AOD_CSV_YEARLY,
            fileFormat="CSV",
        )
        t2.start()
        tasks.append(t2)

    return tasks
