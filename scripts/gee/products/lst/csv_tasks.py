"""
CSV LST area urbana.

- Mensual: climatología calculada on-the-fly desde Landsat L8+L9.
- Anual: desde asset LST_Yearly.
"""
from __future__ import annotations

import ee

from ...config import paths
from ...earth_engine_init import vectors
from ...drive.drive_export_gate import DriveExportGate
from ...lib import yearmonth as ym_lib
from .constants import LST_START_YEAR
from .raster_tasks import _build_lst_landsat_collection


def start_lst_csv_tasks(
    ic_yearly: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic_yearly = (ic_yearly or vectors.lst_yearly_collection()).filter(
        ee.Filter.gte("year", LST_START_YEAR)
    )
    urban = vectors.area_urbana_quilpue_as_collection()
    region_fc = vectors.lst_landsat_region_fc()
    tasks: list[ee.batch.Task] = []

    # --- Monthly CSV (from Landsat directly) ---
    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_LST_CSV_MONTHLY, "LST_m_urban", (".csv",)
        )
    ):
        landsat = _build_lst_landsat_collection(region_fc).select("LST_mean")
        months = ee.List.sequence(1, 12)
        by_month = ee.ImageCollection.fromImages(
            months.map(
                lambda m: ee.Image(
                    landsat.filter(ee.Filter.calendarRange(m, m, "month"))
                    .median()
                    .rename("LST_mean")
                ).set("month", m)
            )
        )
        triplets_m = by_month.map(
            lambda image: image.reduceRegions(
                collection=urban, reducer=ee.Reducer.mean(), scale=30
            ).map(lambda f: f.set("Month", image.get("month")))
        ).flatten()
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

    # --- Yearly CSV (from asset LST_Yearly) ---
    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_LST_CSV_YEARLY, "LST_y_urban", (".csv",)
        )
    ):
        max_export_year = ym_lib.last_completed_wall_clock_calendar_year()
        all_years_raw = (
            ic_yearly.aggregate_array("year").distinct().sort().getInfo() or []
        )
        year_list = [
            y for y in all_years_raw
            if LST_START_YEAR <= int(y) <= max_export_year
        ]
        if not year_list:
            print("  [WARN] LST CSV anual: sin años disponibles en la colección.")
        else:
            years_ee = ee.List(year_list)
            by_year = ee.ImageCollection.fromImages(
                years_ee.map(
                    lambda y: ic_yearly.select("LST_mean")
                    .filter(ee.Filter.eq("year", y))
                    .first()
                    .rename("LST_mean")
                    .set("year", y)
                )
            )
            triplets_y = by_year.map(
                lambda image: image.reduceRegions(
                    collection=urban, reducer=ee.Reducer.mean(), scale=30
                ).map(lambda f: f.set("Year", image.get("year")))
            ).flatten()
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
            print(
                f"  [CSV LST anual] Exportando {len(year_list)} año(s): "
                f"{int(year_list[0])}–{int(year_list[-1])}"
            )

    return tasks
