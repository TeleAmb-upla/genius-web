"""CSV LST área urbana (scripts/LST_csv.txt)."""
from __future__ import annotations

import ee

from ... import paths
from ... import vectors
from ...drive_export_gate import DriveExportGate


def start_lst_csv_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or vectors.lst_yearmonth_collection()
    urban = vectors.area_urbana_as_collection()
    tasks: list[ee.batch.Task] = []

    months = ee.List.sequence(1, 12)
    by_month = ee.ImageCollection.fromImages(
        months.map(
            lambda m: ee.Image(
                ic.select("LST_mean")
                .filter(ee.Filter.eq("month", m))
                .median()
                .rename("LST_mean")
            )
            .set("month", m)
        )
    )
    triplets_m = by_month.map(
        lambda image: image.reduceRegions(
            collection=urban, reducer=ee.Reducer.mean(), scale=30
        ).map(lambda f: f.set("Month", image.get("month")))
    ).flatten()

    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_LST_CSV_MONTHLY,
            "LST_m_urban",
            (".csv",),
        )
    ):
        t1 = ee.batch.Export.table.toDrive(
            collection=triplets_m,
            selectors=["Month", "LST_mean"],
            description="LST_m_urban",
            fileNamePrefix="LST_m_urban",
            folder=paths.DRIVE_LST_CSV_MONTHLY,
            fileFormat="CSV",
        )
        t1.start()
        tasks.append(t1)

    years = ee.List(ic.aggregate_array("year")).distinct().sort()
    by_year = ee.ImageCollection.fromImages(
        years.map(
            lambda y: ee.Image(
                ic.select("LST_mean")
                .filter(ee.Filter.eq("year", y))
                .median()
                .rename("LST_mean")
            )
            .set("year", y)
        )
    )
    triplets_y = by_year.map(
        lambda image: image.reduceRegions(
            collection=urban, reducer=ee.Reducer.mean(), scale=30
        ).map(lambda f: f.set("Year", image.get("year")))
    ).flatten()

    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_LST_CSV_YEARLY,
            "LST_y_urban",
            (".csv",),
        )
    ):
        t2 = ee.batch.Export.table.toDrive(
            collection=triplets_y,
            selectors=["Year", "LST_mean"],
            description="LST_y_urban",
            fileNamePrefix="LST_y_urban",
            folder=paths.DRIVE_LST_CSV_YEARLY,
            fileFormat="CSV",
        )
        t2.start()
        tasks.append(t2)

    return tasks
