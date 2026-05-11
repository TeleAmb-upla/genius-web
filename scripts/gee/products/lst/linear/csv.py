"""
CSV LST área urbana y zonal por barrios (manzanas solo GeoJSON).
Leer de arriba abajo (estilo Earth Engine Code Editor). API estable vía ``../csv_tasks.py``.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any

import ee

from ....config import paths
from ....earth_engine_init import vectors
from ....drive.drive_export_gate import DriveExportGate
from ....lib import monthly_climatology_percentiles as mcp
from ....lib import yearmonth as ym_lib
from ..asset_bounds import lst_asset_min_year


def _lst_export_cap_ym(ic_ym: ee.ImageCollection) -> tuple[int, int] | None:
    """Último (año, mes) a exportar en CSV año–mes: mínimo entre GEE y muro UTC."""
    src = ym_lib.get_collection_max_ym(ic_ym)
    if src is None:
        return None
    wall = ym_lib.last_complete_calendar_month_utc()
    if ym_lib.ym_strictly_before(wall, src):
        return wall
    return src


def start_lst_csv_tasks(
    ic_yearly: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic_yearly = (ic_yearly or vectors.lst_yearly_collection()).filter(
        ee.Filter.gte("year", lst_asset_min_year())
    )
    ic_ym = vectors.lst_yearmonth_collection().select("LST_mean")
    urban = vectors.area_urbana_quilpue_as_collection()
    tasks: list[ee.batch.Task] = []

    # --- Monthly CSV: urbano + zonal (desde LST_YearMonth) ---
    skip_m_u = bool(
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_LST_CSV_MONTHLY, "LST_m_urban", (".csv",)
        )
    )
    skip_m_zb = bool(
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_LST_CSV_MONTHLY, "LST_m_zonal_barrios", (".csv",)
        )
    )
    if not (skip_m_u and skip_m_zb):
        months = ee.List.sequence(1, 12)
        wall_cal_y = datetime.utcnow().year
        _ly_c, _lm_c = ym_lib.last_complete_calendar_month_utc()
        wall_cal_m = _lm_c if _ly_c == wall_cal_y else 0

        if not skip_m_u:

            def _lst_m_row(m: Any) -> ee.Feature:
                return mcp.lst_urban_month_row_from_yearmonth_ic(
                    ic_ym,
                    month=ee.Number(m),
                    region=urban,
                    wall_year=wall_cal_y,
                    wall_month=wall_cal_m,
                    scale=30,
                )

            triplets_m = ee.FeatureCollection(months.map(_lst_m_row))
            t1 = ee.batch.Export.table.toDrive(
                collection=triplets_m,
                selectors=["Month", "LST_mean", "LST_p25", "LST_p75", "anio_actual"],
                description="LST_m_urban",
                fileNamePrefix="LST_m_urban",
                folder=paths.DRIVE_LST_CSV_MONTHLY,
                fileFormat="CSV",
            )
            t1.start()
            tasks.append(t1)

        barrios = vectors.barrios_quilpue()

        def zonal_rows_per_barrio_month(mo: Any) -> ee.FeatureCollection:
            mo_n = ee.Number(mo)

            def row_for_barrio(feat: Any) -> ee.Feature:
                return mcp.lst_zonal_unit_month_row_from_yearmonth_ic(
                    ic_ym,
                    month=mo_n,
                    unit_fc=ee.FeatureCollection([ee.Feature(feat)]),
                    id_prop="NOMBRE",
                    wall_year=wall_cal_y,
                    wall_month=wall_cal_m,
                    scale=30,
                )

            return barrios.map(row_for_barrio)

        fc_zonal_b = ee.FeatureCollection(months.map(zonal_rows_per_barrio_month)).flatten()

        if not skip_m_zb:
            t_zb = ee.batch.Export.table.toDrive(
                collection=fc_zonal_b,
                description="LST_m_zonal_barrios",
                folder=paths.DRIVE_LST_CSV_MONTHLY,
                fileNamePrefix="LST_m_zonal_barrios",
                fileFormat="CSV",
                selectors=[
                    "NOMBRE",
                    "Month",
                    "LST_mean",
                    "LST_p25",
                    "LST_p75",
                    "anio_actual",
                ],
            )
            t_zb.start()
            tasks.append(t_zb)

    # --- Year–month CSV (urbano): una fila por (year, month) presente hasta tope ---
    if not (
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_LST_CSV_MONTHLY, "LST_YearMonth_urban", (".csv",)
        )
    ):
        cap = _lst_export_cap_ym(ic_ym)
        if cap is None:
            print("  [WARN] LST_YearMonth_urban: colección año–mes vacía.")
        else:
            last_y_ym, last_m_ym = cap
            min_y_raw = ic_ym.aggregate_min("year").getInfo()
            lo = lst_asset_min_year()
            y0 = (
                max(lo, int(min_y_raw))
                if min_y_raw is not None
                else lo
            )
            pair_items: list[Any] = []
            for y_py in range(y0, last_y_ym + 1):
                m_hi = 12 if y_py < last_y_ym else last_m_ym
                for mo_py in range(1, m_hi + 1):
                    pair_items.append(ee.Dictionary({"y": y_py, "mo": mo_py}))
            pairs = ee.List(pair_items)

            def _lst_ym_one(pair: Any) -> ee.Feature:
                d = ee.Dictionary(pair)
                y = ee.Number(d.get("y"))
                mo = ee.Number(d.get("mo"))
                subset = ic_ym.filter(
                    ee.Filter.And(
                        ee.Filter.eq("year", y),
                        ee.Filter.eq("month", mo),
                    )
                )
                has_data = subset.size().gt(0)
                composite = (
                    ee.Image(subset.select("LST_mean").median())
                    .clip(urban.geometry())
                )
                no_obs = (
                    ee.Image.constant(-9999.0)
                    .float()
                    .rename("LST_mean")
                    .updateMask(ee.Image.constant(0.0))
                )
                img = ee.Image(ee.Algorithms.If(has_data, composite, no_obs))
                stat = img.reduceRegion(
                    reducer=ee.Reducer.median(),
                    geometry=urban.geometry(),
                    scale=30,
                    maxPixels=1e13,
                    tileScale=4,
                    bestEffort=True,
                )
                d = ee.Dictionary(stat)
                names = d.keys()
                mu = ee.Algorithms.If(
                    names.contains("LST_mean_median"),
                    d.get("LST_mean_median"),
                    ee.Algorithms.If(
                        names.contains("median"),
                        d.get("median"),
                        ee.Algorithms.If(
                            names.contains("LST_mean_mean"),
                            d.get("LST_mean_mean"),
                            ee.Algorithms.If(
                                names.contains("mean"),
                                d.get("mean"),
                                d.get("LST_mean"),
                            ),
                        ),
                    ),
                )
                safe_mu = ee.Algorithms.If(mu, mu, -9999.0)
                return ee.Feature(
                    None,
                    {
                        "Year": y.format("%.0f"),
                        "Month": mo.format("%.0f"),
                        "LST_mean": ee.Number(safe_mu).format("%.6f"),
                    },
                )

            t_ym = ee.batch.Export.table.toDrive(
                collection=ee.FeatureCollection(pairs.map(_lst_ym_one)),
                selectors=["Year", "Month", "LST_mean"],
                description="LST_YearMonth_urban",
                fileNamePrefix="LST_YearMonth_urban",
                folder=paths.DRIVE_LST_CSV_MONTHLY,
                fileFormat="CSV",
            )
            t_ym.start()
            tasks.append(t_ym)

    # --- Yearly CSV (serie anual derivada): urbano + zonal ---
    skip_y_u = bool(
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_LST_CSV_YEARLY, "LST_y_urban", (".csv",)
        )
    )
    skip_y_zb = bool(
        drive_gate
        and drive_gate.should_skip_export(
            paths.DRIVE_LST_CSV_YEARLY, "LST_y_zonal_barrios", (".csv",)
        )
    )
    if not (skip_y_u and skip_y_zb):
        wall_year = ym_lib.last_completed_wall_clock_calendar_year()
        max_asset_year = ym_lib.get_collection_max_year(ic_yearly)
        if max_asset_year is None:
            year_list: list[int] = []
            max_export_year = wall_year
        else:
            max_export_year = min(max_asset_year, wall_year)
            year_list = ym_lib.get_collection_distinct_years(
                ic_yearly,
                max_year=max_export_year,
            )
        if not year_list:
            print("  [WARN] LST CSV anual: sin años disponibles en la colección.")
        else:
            if max_export_year < wall_year:
                print(
                    f"  [CSV LST anual] Serie anual disponible hasta {max_export_year}; "
                    f"se omiten años > {max_export_year}."
                )
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

            def yearly_urban_table(image: ee.Image) -> ee.FeatureCollection:
                y = ee.Number(ee.Image(image).get("year"))
                d = ee.Dictionary(
                    mcp.lst_intraannual_monthly_scalar_percentiles(
                        ic_ym,
                        year=y,
                        unit_fc=urban,
                        scale=30,
                    )
                )
                return ee.FeatureCollection(
                    [
                        ee.Feature(
                            None,
                            {
                                "Year": y,
                                "LST_mean": ee.Number(d.get("p50")).format("%.6f"),
                                "LST_p25": ee.Number(d.get("p25")).format("%.6f"),
                                "LST_p75": ee.Number(d.get("p75")).format("%.6f"),
                            },
                        )
                    ]
                )

            barrios_y = vectors.barrios_quilpue()

            def yearly_barrio_table(image: ee.Image) -> ee.FeatureCollection:
                y = ee.Number(ee.Image(image).get("year"))

                def one_b(feat: Any) -> ee.Feature:
                    feat = ee.Feature(feat)
                    fc = ee.FeatureCollection([feat])
                    d = ee.Dictionary(
                        mcp.lst_intraannual_monthly_scalar_percentiles(
                            ic_ym,
                            year=y,
                            unit_fc=fc,
                            scale=30,
                        )
                    )
                    return ee.Feature(
                        None,
                        {
                            "Year": y,
                            "NOMBRE": feat.get("NOMBRE"),
                            "LST_mean": ee.Number(d.get("p50")).format("%.6f"),
                            "LST_p25": ee.Number(d.get("p25")).format("%.6f"),
                            "LST_p75": ee.Number(d.get("p75")).format("%.6f"),
                        },
                    )

                return barrios_y.map(one_b)

            if not skip_y_u:
                triplets_y = by_year.map(yearly_urban_table).flatten()
                t2 = ee.batch.Export.table.toDrive(
                    collection=triplets_y,
                    selectors=["Year", "LST_mean", "LST_p25", "LST_p75"],
                    description="LST_y_urban",
                    fileNamePrefix="LST_y_urban",
                    folder=paths.DRIVE_LST_CSV_YEARLY,
                    fileFormat="CSV",
                )
                t2.start()
                tasks.append(t2)

            if not skip_y_zb:
                triplets_y_zb = by_year.map(yearly_barrio_table).flatten()
                t_zb_y = ee.batch.Export.table.toDrive(
                    collection=triplets_y_zb,
                    selectors=["Year", "NOMBRE", "LST_mean", "LST_p25", "LST_p75"],
                    description="LST_y_zonal_barrios",
                    fileNamePrefix="LST_y_zonal_barrios",
                    folder=paths.DRIVE_LST_CSV_YEARLY,
                    fileFormat="CSV",
                )
                t_zb_y.start()
                tasks.append(t_zb_y)

            print(
                f"  [CSV LST anual] Exportando {len(year_list)} año(s): "
                f"{int(year_list[0])}–{int(year_list[-1])}"
            )

    return tasks
