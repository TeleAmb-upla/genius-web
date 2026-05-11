"""
GeoJSON zonal AOD (scripts/AOD_geojson.txt).
Leer de arriba abajo (estilo Earth Engine Code Editor). API estable vía ``../geojson_tasks.py``.
"""
from __future__ import annotations

from .....config import paths
from .....earth_engine_init import vectors
from .....drive.drive_export_gate import DriveExportGate
from .....lib import mk_sen as mk_sen_lib
from .....lib import unified_product_extraction as upe
from .....lib import yearmonth as ym_lib


def start_aod_m_geojson_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or vectors.aod_yearmonth_collection()
    return upe.monthly_zonal_geojson_barrios_manzanas(
        ic,
        source_band="AOD_median",
        value_property="AOD_median",
        stem_prefix="AOD_Monthly_ZonalStats",
        drive_folder_b=paths.DRIVE_AOD_GEO_MONTHLY_B,
        drive_folder_m=paths.DRIVE_AOD_GEO_MONTHLY_M,
        scale_m=1000,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
    )


def start_aod_y_geojson_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or vectors.aod_yearmonth_collection()
    ly = ym_lib.effective_yearly_export_year(ic)
    return upe.yearly_zonal_geojson_barrios_manzanas(
        ic,
        source_band="AOD_median",
        value_property="AOD_median",
        stem_prefix="AOD_Yearly_ZonalStats",
        drive_folder_b=paths.DRIVE_AOD_GEO_YEARLY_B,
        drive_folder_m=paths.DRIVE_AOD_GEO_YEARLY_M,
        scale_m=1000,
        last_year=ly,
        year_numbers=year_numbers,
        drive_gate=drive_gate,
    )


def start_aod_t_geojson_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    ic = ic or vectors.aod_yearmonth_collection()
    sens, pval = mk_sen_lib.mk_sen_slope_and_p_value(ic, band_name="AOD_median")
    return upe.trend_zonal_geojson_barrios_manzanas(
        sens,
        pval,
        drive_folder_b=paths.DRIVE_AOD_GEO_TREND_B,
        drive_folder_m=paths.DRIVE_AOD_GEO_TREND_M,
        stem_b="Trend_AOD_ZonalStats_Barrios",
        stem_m="Trend_AOD_ZonalStats_Manzanas",
        scale_m=500,
        drive_gate=drive_gate,
    )
