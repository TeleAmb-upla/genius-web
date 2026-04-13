"""GeoJSON zonal AOD (scripts/AOD_geojson.txt)."""
from __future__ import annotations

import ee

from ....config import paths
from ....earth_engine_init import vectors
from ....drive.drive_export_gate import DriveExportGate
from ....lib import mk_sen as mk_sen_lib
from ....lib import yearmonth as ym_lib
from ....lib import zonal_geojson


def start_aod_m_geojson_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or vectors.aod_yearmonth_collection()
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    tasks: list[ee.batch.Task] = []
    tasks += zonal_geojson.months_zonal_geojson_tasks(
        ic,
        source_band="AOD_median",
        value_property="AOD_median",
        stem_prefix="AOD_Monthly_ZonalStats",
        unidad_fc=barrios,
        nombre_prefijo="Barrios",
        drive_folder=paths.DRIVE_AOD_GEO_MONTHLY_B,
        selectores=["NOMBRE", "POBLACION", "Month", "AOD_median", ".geo"],
        scale_m=1000,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
    )
    tasks += zonal_geojson.months_zonal_geojson_tasks(
        ic,
        source_band="AOD_median",
        value_property="AOD_median",
        stem_prefix="AOD_Monthly_ZonalStats",
        unidad_fc=manzanas,
        nombre_prefijo="Manzanas",
        drive_folder=paths.DRIVE_AOD_GEO_MONTHLY_M,
        selectores=["MANZENT", "TOTAL_PERS", "Month", "AOD_median", ".geo"],
        scale_m=1000,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
    )
    return tasks


def start_aod_y_geojson_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or vectors.aod_yearmonth_collection()
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    ly = ym_lib.effective_yearly_export_year(ic)
    tasks: list[ee.batch.Task] = []
    tasks += zonal_geojson.yearly_zonal_geojson_tasks_last_year(
        ic,
        source_band="AOD_median",
        value_property="AOD_median",
        stem_prefix="AOD_Yearly_ZonalStats",
        last_year=ly,
        year_numbers=year_numbers,
        unidad_fc=barrios,
        nombre_prefijo="Barrios",
        drive_folder=paths.DRIVE_AOD_GEO_YEARLY_B,
        selectores=["NOMBRE", "POBLACION", "Year", "AOD_median", ".geo"],
        scale_m=1000,
        drive_gate=drive_gate,
    )
    tasks += zonal_geojson.yearly_zonal_geojson_tasks_last_year(
        ic,
        source_band="AOD_median",
        value_property="AOD_median",
        stem_prefix="AOD_Yearly_ZonalStats",
        last_year=ly,
        year_numbers=year_numbers,
        unidad_fc=manzanas,
        nombre_prefijo="Manzanas",
        drive_folder=paths.DRIVE_AOD_GEO_YEARLY_M,
        selectores=["MANZENT", "TOTAL_PERS", "Year", "AOD_median", ".geo"],
        scale_m=1000,
        drive_gate=drive_gate,
    )
    return tasks


def start_aod_t_geojson_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or vectors.aod_yearmonth_collection()
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    sens, pval = mk_sen_lib.mk_sen_slope_and_p_value(ic, band_name="AOD_median")
    return zonal_geojson.trend_zonal_geojson_tasks(
        sens,
        pval,
        barrios=barrios,
        manzanas=manzanas,
        drive_folder_b=paths.DRIVE_AOD_GEO_TREND_B,
        drive_folder_m=paths.DRIVE_AOD_GEO_TREND_M,
        stem_b="Trend_AOD_ZonalStats_Barrios",
        stem_m="Trend_AOD_ZonalStats_Manzanas",
        selectors_b=["NOMBRE", "POBLACION", "slope_median", "p_value", ".geo"],
        selectors_m=["MANZENT", "TOTAL_PERS", "slope_median", "p_value", ".geo"],
        scale_m=500,
        drive_gate=drive_gate,
    )
