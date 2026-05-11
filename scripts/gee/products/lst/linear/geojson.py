"""
GeoJSON LST.
Leer de arriba abajo (estilo Earth Engine Code Editor). API estable vía ``../geojson_tasks.py``.
"""
from __future__ import annotations

import ee

from ....config import paths
from ....earth_engine_init import vectors
from ....drive.drive_export_gate import DriveExportGate
from ....lib import mk_sen as mk_sen_lib
from ....lib import unified_product_extraction as upe
from ....lib import yearmonth as ym_lib
from ..asset_bounds import lst_asset_min_year


def start_lst_m_geojson_tasks(
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """Mismo patrón que NDVI: mediana por ``month`` sobre ``LST_YearMonth`` (desde el año mínimo del asset)."""
    lo = lst_asset_min_year()
    ic = (
        vectors.lst_yearmonth_collection()
        .filter(ee.Filter.gte("year", lo))
        .select("LST_mean")
    )
    return upe.monthly_zonal_geojson_barrios_manzanas(
        ic,
        source_band="LST_mean",
        value_property="LST_mean",
        stem_prefix="LST_Monthly_ZonalStats",
        drive_folder_b=paths.DRIVE_LST_GEO_MONTHLY_B,
        drive_folder_m=paths.DRIVE_LST_GEO_MONTHLY_M,
        scale_m=30,
        month_numbers=month_numbers,
        drive_gate=drive_gate,
    )


def start_lst_y_geojson_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    year_numbers: list[int] | None = None,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """Yearly zonal desde serie anual derivada."""
    lo = lst_asset_min_year()
    ic = (ic or vectors.lst_yearly_collection()).filter(
        ee.Filter.gte("year", lo)
    )
    max_y = ym_lib.get_collection_max_year(ic)
    if max_y is None:
        return []
    ic_ym_rules = vectors.lst_yearmonth_collection().filter(
        ee.Filter.gte("year", lo)
    )
    ly_eff = ym_lib.effective_yearly_export_year(ic_ym_rules)
    wall = ym_lib.last_completed_wall_clock_calendar_year()
    ly = min(ly_eff, max_y, wall)
    ly = max(ly, lo)
    return upe.yearly_zonal_geojson_barrios_manzanas(
        ic,
        source_band="LST_mean",
        value_property="LST_mean",
        stem_prefix="LST_Yearly_ZonalStats",
        drive_folder_b=paths.DRIVE_LST_GEO_YEARLY_B,
        drive_folder_m=paths.DRIVE_LST_GEO_YEARLY_M,
        scale_m=30,
        last_year=ly,
        year_numbers=year_numbers,
        drive_gate=drive_gate,
    )


def start_lst_t_geojson_tasks(
    ic: ee.ImageCollection | None = None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """Trend zonal desde serie anual derivada."""
    lo = lst_asset_min_year()
    ic = (ic or vectors.lst_yearly_collection()).filter(
        ee.Filter.gte("year", lo)
    )
    sens, pval = mk_sen_lib.mk_sen_slope_and_p_value_annual(
        ic, "LST_mean"
    )
    return upe.trend_zonal_geojson_barrios_manzanas(
        sens,
        pval,
        drive_folder_b=paths.DRIVE_LST_GEO_TREND_B,
        drive_folder_m=paths.DRIVE_LST_GEO_TREND_M,
        stem_b="Trend_LST_ZonalStats_Barrios",
        stem_m="Trend_LST_ZonalStats_Manzanas",
        scale_m=30,
        drive_gate=drive_gate,
    )
