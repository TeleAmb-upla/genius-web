"""GeoJSON LST (scripts/LST_geojson.txt)."""
from __future__ import annotations

import ee

from ... import paths
from ... import vectors
from ...drive_export_gate import DriveExportGate
from ...lib import mk_sen as mk_sen_lib
from ...lib import yearmonth as ym_lib
from ...lib import zonal_geojson


def start_lst_m_geojson_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or vectors.lst_yearmonth_collection()
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    tasks: list[ee.batch.Task] = []
    tasks += zonal_geojson.months_zonal_geojson_tasks(
        ic,
        source_band="LST_mean",
        value_property="LST_mean",
        stem_prefix="LST_Monthly_ZonalStats",
        unidad_fc=barrios,
        nombre_prefijo="Barrios",
        drive_folder=paths.DRIVE_LST_GEO_MONTHLY_B,
        selectores=["NOMBRE", "POBLACION", "Month", "LST_mean", ".geo"],
        scale_m=30,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
    )
    tasks += zonal_geojson.months_zonal_geojson_tasks(
        ic,
        source_band="LST_mean",
        value_property="LST_mean",
        stem_prefix="LST_Monthly_ZonalStats",
        unidad_fc=manzanas,
        nombre_prefijo="Manzanas",
        drive_folder=paths.DRIVE_LST_GEO_MONTHLY_M,
        selectores=["MANZENT", "TOTAL_PERS", "Month", "LST_mean", ".geo"],
        scale_m=30,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
    )
    return tasks


def start_lst_y_geojson_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or vectors.lst_yearmonth_collection()
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    ly = ym_lib.effective_yearly_export_year(ic)
    tasks: list[ee.batch.Task] = []
    tasks += zonal_geojson.yearly_zonal_geojson_tasks_last_year(
        ic,
        source_band="LST_mean",
        value_property="LST_mean",
        stem_prefix="LST_Yearly_ZonalStats",
        last_year=ly,
        unidad_fc=barrios,
        nombre_prefijo="Barrios",
        drive_folder=paths.DRIVE_LST_GEO_YEARLY_B,
        selectores=["NOMBRE", "POBLACION", "Year", "LST_mean", ".geo"],
        scale_m=30,
        drive_gate=drive_gate,
    )
    tasks += zonal_geojson.yearly_zonal_geojson_tasks_last_year(
        ic,
        source_band="LST_mean",
        value_property="LST_mean",
        stem_prefix="LST_Yearly_ZonalStats",
        last_year=ly,
        unidad_fc=manzanas,
        nombre_prefijo="Manzanas",
        drive_folder=paths.DRIVE_LST_GEO_YEARLY_M,
        selectores=["MANZENT", "TOTAL_PERS", "Year", "LST_mean", ".geo"],
        scale_m=30,
        drive_gate=drive_gate,
    )
    return tasks


def start_lst_t_geojson_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or vectors.lst_yearmonth_collection()
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    sens, pval = mk_sen_lib.mk_sen_slope_and_p_value(ic, band_name="LST_mean")
    return zonal_geojson.trend_zonal_geojson_tasks(
        sens,
        pval,
        barrios=barrios,
        manzanas=manzanas,
        drive_folder_b=paths.DRIVE_LST_GEO_TREND_B,
        drive_folder_m=paths.DRIVE_LST_GEO_TREND_M,
        stem_b="Trend_LST_ZonalStats_Barrios",
        stem_m="Trend_LST_ZonalStats_Manzanas",
        selectors_b=["NOMBRE", "POBLACION", "slope_median", "p_value", ".geo"],
        selectors_m=["MANZENT", "TOTAL_PERS", "slope_median", "p_value", ".geo"],
        scale_m=30,
        drive_gate=drive_gate,
    )
