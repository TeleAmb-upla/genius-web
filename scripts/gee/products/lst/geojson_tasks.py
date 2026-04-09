"""
GeoJSON LST.

- Mensual: climatología on-the-fly desde Landsat (necesita propiedad ``month``).
- Anual y trend: desde asset LST_Yearly.
"""
from __future__ import annotations

import ee

from ...config import paths
from ...earth_engine_init import vectors
from ...drive.drive_export_gate import DriveExportGate
from ...lib import mk_sen as mk_sen_lib
from ...lib import yearmonth as ym_lib
from ...lib import zonal_geojson
from .constants import LST_START_YEAR
from .raster_tasks import _build_lst_landsat_collection


def _build_monthly_composite_ic() -> ee.ImageCollection:
    """12 monthly median images from Landsat with ``month`` property (for zonal lib)."""
    region_fc = vectors.lst_landsat_region_fc()
    landsat = _build_lst_landsat_collection(region_fc).select("LST_mean")
    months = ee.List.sequence(1, 12)
    return ee.ImageCollection.fromImages(
        months.map(
            lambda m: ee.Image(
                landsat.filter(ee.Filter.calendarRange(m, m, "month"))
                .median()
                .rename("LST_mean")
            ).set("month", m)
        )
    )


def start_lst_m_geojson_tasks(
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = _build_monthly_composite_ic()
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
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """Yearly zonal from asset LST_Yearly."""
    ic = (ic or vectors.lst_yearly_collection()).filter(
        ee.Filter.gte("year", LST_START_YEAR)
    )
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    max_y = ym_lib.get_collection_max_year(ic)
    if max_y is None:
        return []
    wall = ym_lib.last_completed_wall_clock_calendar_year()
    ly = min(max_y, wall)
    tasks: list[ee.batch.Task] = []
    tasks += zonal_geojson.yearly_zonal_geojson_tasks_last_year(
        ic,
        source_band="LST_mean",
        value_property="LST_mean",
        stem_prefix="LST_Yearly_ZonalStats",
        last_year=ly,
        year_numbers=year_numbers,
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
        year_numbers=year_numbers,
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
    """Trend zonal from asset LST_Yearly."""
    ic = (ic or vectors.lst_yearly_collection()).filter(
        ee.Filter.gte("year", LST_START_YEAR)
    )
    barrios = vectors.barrios_quilpue()
    manzanas = vectors.manzanas_quilpue()
    sens, pval = mk_sen_lib.mk_sen_slope_and_p_value_annual(
        ic, "LST_mean"
    )
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
