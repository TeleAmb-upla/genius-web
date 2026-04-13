"""Configuración NO2 / SO2 (Sentinel-5P L3)."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from ...config import paths


@dataclass(frozen=True)
class PollutantSpec:
    key: str
    state_filename: str
    asset_ym: str
    l3_collection: str
    sensor_band: str
    asset_median_band: str
    ym_prefix: str
    filter_start: str
    drive_monthly: str
    drive_yearly: str
    drive_trend: str
    drive_geo_m_b: str
    drive_geo_m_m: str
    drive_geo_y_b: str
    drive_geo_y_m: str
    repo_raster_m: Path
    repo_raster_y: Path
    repo_raster_t: Path
    # Regresión aplicada al raster/CSV anual y mensual (None = solo escala 1e6 en banda)
    regression_expr: str | None
    export_band_name: str
    first_year_offset_trend: int
    geo_trend_stem_b: str
    geo_trend_stem_m: str


def no2_spec() -> PollutantSpec:
    return PollutantSpec(
        key="no2",
        state_filename="no2_export_state.json",
        asset_ym=paths.ASSET_NO2_YEARMONTH,
        l3_collection="COPERNICUS/S5P/OFFL/L3_NO2",
        sensor_band="tropospheric_NO2_column_number_density",
        asset_median_band="NO2_median",
        ym_prefix="NO2_YearMonth",
        filter_start="2019-01-01",
        drive_monthly=paths.DRIVE_NO2_RASTER_MONTHLY,
        drive_yearly=paths.DRIVE_NO2_RASTER_YEARLY,
        drive_trend=paths.DRIVE_NO2_RASTER_TREND,
        drive_geo_m_b=paths.DRIVE_NO2_GEO_MONTHLY_B,
        drive_geo_m_m=paths.DRIVE_NO2_GEO_MONTHLY_M,
        drive_geo_y_b=paths.DRIVE_NO2_GEO_YEARLY_B,
        drive_geo_y_m=paths.DRIVE_NO2_GEO_YEARLY_M,
        repo_raster_m=paths.REPO_RASTER_NO2_MONTHLY,
        repo_raster_y=paths.REPO_RASTER_NO2_YEARLY,
        repo_raster_t=paths.REPO_RASTER_NO2_TREND,
        regression_expr="(0.1096 * (b() * 1000000)) + 9.3534",
        export_band_name="NO2_median",
        first_year_offset_trend=0,
        geo_trend_stem_b="Trend_NO2_ZonalStats_Barrios",
        geo_trend_stem_m="Trend_NO2_ZonalStats_Manzanas",
    )


def so2_spec() -> PollutantSpec:
    return PollutantSpec(
        key="so2",
        state_filename="so2_export_state.json",
        asset_ym=paths.ASSET_SO2_YEARMONTH,
        l3_collection="COPERNICUS/S5P/OFFL/L3_SO2",
        sensor_band="SO2_column_number_density",
        asset_median_band="SO2_median",
        ym_prefix="SO2_YearMonth",
        filter_start="2019-01-01",
        drive_monthly=paths.DRIVE_SO2_RASTER_MONTHLY,
        drive_yearly=paths.DRIVE_SO2_RASTER_YEARLY,
        drive_trend=paths.DRIVE_SO2_RASTER_TREND,
        drive_geo_m_b=paths.DRIVE_SO2_GEO_MONTHLY_B,
        drive_geo_m_m=paths.DRIVE_SO2_GEO_MONTHLY_M,
        drive_geo_y_b=paths.DRIVE_SO2_GEO_YEARLY_B,
        drive_geo_y_m=paths.DRIVE_SO2_GEO_YEARLY_M,
        repo_raster_m=paths.REPO_RASTER_SO2_MONTHLY,
        repo_raster_y=paths.REPO_RASTER_SO2_YEARLY,
        repo_raster_t=paths.REPO_RASTER_SO2_TREND,
        regression_expr=None,
        export_band_name="SO2",
        first_year_offset_trend=0,
        geo_trend_stem_b="Trend_SO2_ZonalStats_Barrios",
        geo_trend_stem_m="Trend_SO2_ZonalStats_Manzanas",
    )
