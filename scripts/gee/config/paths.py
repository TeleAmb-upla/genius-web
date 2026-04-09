"""
Rutas del repositorio (relativas a la raíz del proyecto) y nombres de carpeta en Google Drive.

Earth Engine solo admite un nombre de carpeta de Drive por exportación (sin subrutas).
Tras completar las tareas en https://code.earthengine.google.com/tasks , descarga los
archivos y colócalos en las rutas REPO_* indicadas para que coincidan con el front-end.

Flujo encolado + espera + descarga: python -m scripts.gee.pipeline
Solo descarga desde Drive: python -m scripts.gee.drive.download_drive_to_repo
(ambos usan las credenciales de earthengine authenticate).
"""
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]

# Proyecto de Google Cloud para la API de Earth Engine (ee.Initialize).
# Si EARTH_ENGINE_PROJECT existe pero está vacío, se ignora y se usa el default.
EE_CLOUD_PROJECT = (os.environ.get("EARTH_ENGINE_PROJECT") or "").strip() or "ee-plataformagenius"

# OAuth JSON generado por `earthengine authenticate` (copiar aquí para uso automático; ver secrets/README.md).
EE_OAUTH_CREDENTIALS_FILE = PROJECT_ROOT / "secrets" / "earthengine_credentials.json"

# --- Destino en el repo (documentación / post-proceso manual) ---
REPO_RASTER_NDVI_MONTHLY = PROJECT_ROOT / "assets" / "data" / "raster" / "NDVI" / "NDVI_Monthly"
REPO_RASTER_NDVI_YEARLY = PROJECT_ROOT / "assets" / "data" / "raster" / "NDVI" / "NDVI_Yearly"
REPO_RASTER_NDVI_TREND = PROJECT_ROOT / "assets" / "data" / "raster" / "NDVI" / "NDVI_Trend"
REPO_RASTER_NDVI_SD = PROJECT_ROOT / "assets" / "data" / "raster" / "NDVI" / "NDVI_SD"

REPO_CSV = PROJECT_ROOT / "assets" / "data" / "csv"
# Serie año-mes (CSV; mismo árbol que antes para NDVI_*YearMonth*.csv)
REPO_NDVI_YEARMONTH_CSV = (
    PROJECT_ROOT / "assets" / "data" / "raster" / "NDVI" / "NDVI_YearMonth"
)

REPO_GEOJSON_NDVI_MONTHLY_B = PROJECT_ROOT / "assets" / "data" / "geojson" / "NDVI" / "NDVI_Monthly_ZonalStats_Barrios"
REPO_GEOJSON_NDVI_MONTHLY_M = PROJECT_ROOT / "assets" / "data" / "geojson" / "NDVI" / "NDVI_Monthly_ZonalStats_Manzanas"
REPO_GEOJSON_NDVI_YEARLY_B = PROJECT_ROOT / "assets" / "data" / "geojson" / "NDVI" / "NDVI_Yearly_ZonalStats_Barrios"
REPO_GEOJSON_NDVI_YEARLY_M = PROJECT_ROOT / "assets" / "data" / "geojson" / "NDVI" / "NDVI_Yearly_ZonalStats_Manzanas"
REPO_GEOJSON_NDVI_SD = PROJECT_ROOT / "assets" / "data" / "geojson" / "NDVI" / "NDVI_SD_ZonalStats"

# Trend_NDVI_ZonalStats_*.geojson: el front sigue leyendo desde estas rutas locales
# (barrios en carpeta yearly B; manzanas igual que yearly M).
REPO_GEOJSON_NDVI_TREND_B = REPO_GEOJSON_NDVI_YEARLY_B
REPO_GEOJSON_NDVI_TREND_M = REPO_GEOJSON_NDVI_YEARLY_M

# --- Carpetas en Google Drive (crear vacías o EE las crea al exportar) ---
DRIVE_RASTER_MONTHLY = "NDVI_Monthly"
# Solo NDVI_Yearly_YYYY.tif → REPO_RASTER_NDVI_YEARLY (no mezclar con tendencia).
DRIVE_RASTER_YEARLY = "NDVI_Yearly"
# Solo NDVI_Yearly_Trend.tif (Mann–Kendall + Sen) → REPO_RASTER_NDVI_TREND.
DRIVE_RASTER_TREND = "NDVI_Trend"
DRIVE_RASTER_SD = "NDVI_StdDev"

# CSV NDVI -> REPO_CSV (compartido con otros CSV del sitio).
# Mensual: NDVI_m_av, NDVI_m_urban | Anual: NDVI_y_av, NDVI_y_urban (ver csv_tasks.py).
# Año-mes: tabla Year, Month, NDVI (urbano) → REPO_NDVI_YEARMONTH_CSV.
DRIVE_CSV_MONTHLY = "NDVI_Monthly"
DRIVE_CSV_YEARLY = "NDVI_Yearly"
DRIVE_CSV_YEARMONTH = "NDVI_YearMonth"

DRIVE_GEO_MONTHLY_B = "NDVI_Monthly_ZonalStats_Barrios"
DRIVE_GEO_MONTHLY_M = "NDVI_Monthly_ZonalStats_Manzanas"
DRIVE_GEO_YEARLY_B = "NDVI_Yearly_ZonalStats_Barrios"
DRIVE_GEO_YEARLY_M = "NDVI_Yearly_ZonalStats_Manzanas"
DRIVE_GEO_SD_AV = "NDVI_SD_ZonalStats"
DRIVE_GEO_TREND_B = "Trend_NDVI_ZonalStats_Barrios"
DRIVE_GEO_TREND_M = "Trend_NDVI_ZonalStats_Manzanas"

# Asset intermedio (colección año-mes) — igual que en Code Editor JS
ASSET_NDVI_YEARMONTH = "users/plataformagenius/Areas_Verdes/NDVI/NDVI_YearMonth"

# --- AOD (MODIS) ---
ASSET_AOD_YEARMONTH = "users/plataformagenius/Calidad_de_Aire/AOD/AOD_YearMonth"
REPO_RASTER_AOD_MONTHLY = PROJECT_ROOT / "assets" / "data" / "raster" / "AOD" / "AOD_Monthly"
REPO_RASTER_AOD_YEARLY = PROJECT_ROOT / "assets" / "data" / "raster" / "AOD" / "AOD_Yearly"
REPO_RASTER_AOD_TREND = PROJECT_ROOT / "assets" / "data" / "raster" / "AOD" / "AOD_Trend"
REPO_CSV_AOD = REPO_RASTER_AOD_MONTHLY
REPO_GEOJSON_AOD_MONTHLY_B = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "AOD" / "AOD_Monthly_ZonalStats" / "AOD_Monthly_ZonalStats_Barrios"
)
REPO_GEOJSON_AOD_MONTHLY_M = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "AOD" / "AOD_Monthly_ZonalStats" / "AOD_Monthly_ZonalStats_Manzanas"
)
REPO_GEOJSON_AOD_YEARLY_B = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "AOD" / "AOD_Yearly_ZonalStats" / "AOD_Yearly_ZonalStats_Barrios"
)
REPO_GEOJSON_AOD_YEARLY_M = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "AOD" / "AOD_Yearly_ZonalStats" / "AOD_Yearly_ZonalStats_Manzanas"
)
DRIVE_AOD_RASTER_MONTHLY = "AOD_Monthly"
DRIVE_AOD_RASTER_YEARLY = "AOD_Yearly"
DRIVE_AOD_CSV_MONTHLY = DRIVE_AOD_RASTER_MONTHLY
DRIVE_AOD_CSV_YEARLY = DRIVE_AOD_RASTER_YEARLY
DRIVE_AOD_GEO_MONTHLY_B = "AOD_Monthly_ZonalStats_Barrios"
DRIVE_AOD_GEO_MONTHLY_M = "AOD_Monthly_ZonalStats_Manzanas"
DRIVE_AOD_GEO_YEARLY_B = "AOD_Yearly_ZonalStats_Barrios"
DRIVE_AOD_GEO_YEARLY_M = "AOD_Yearly_ZonalStats_Manzanas"
DRIVE_AOD_GEO_TREND_B = "AOD_Yearly_ZonalStats_Barrios"
DRIVE_AOD_GEO_TREND_M = "AOD_Yearly_ZonalStats_Manzanas"

# --- NO2 / SO2 (Sentinel-5P) ---
ASSET_NO2_YEARMONTH = "users/plataformagenius/Calidad_de_Aire/NO2/NO2_YearMonth"
ASSET_SO2_YEARMONTH = "users/plataformagenius/Calidad_de_Aire/SO2/SO2_YearMonth"
REPO_RASTER_NO2_MONTHLY = PROJECT_ROOT / "assets" / "data" / "raster" / "NO2" / "NO2_Monthly"
REPO_RASTER_NO2_YEARLY = PROJECT_ROOT / "assets" / "data" / "raster" / "NO2" / "NO2_Yearly"
REPO_RASTER_NO2_TREND = PROJECT_ROOT / "assets" / "data" / "raster" / "NO2" / "NO2_Trend"
REPO_RASTER_SO2_MONTHLY = PROJECT_ROOT / "assets" / "data" / "raster" / "SO2" / "SO2_Monthly"
REPO_RASTER_SO2_YEARLY = PROJECT_ROOT / "assets" / "data" / "raster" / "SO2" / "SO2_Yearly"
REPO_RASTER_SO2_TREND = PROJECT_ROOT / "assets" / "data" / "raster" / "SO2" / "SO2_Trend"
REPO_GEOJSON_NO2_MONTHLY_B = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "NO2" / "NO2_Monthly_ZonalStats" / "NO2_Monthly_ZonalStats_Barrios"
)
REPO_GEOJSON_NO2_MONTHLY_M = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "NO2" / "NO2_Monthly_ZonalStats" / "NO2_Monthly_ZonalStats_Manzanas"
)
REPO_GEOJSON_NO2_YEARLY_B = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "NO2" / "NO2_Yearly_ZonalStats" / "NO2_Yearly_ZonalStats_Barrios"
)
REPO_GEOJSON_NO2_YEARLY_M = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "NO2" / "NO2_Yearly_ZonalStats" / "NO2_Yearly_ZonalStats_Manzanas"
)
REPO_GEOJSON_SO2_MONTHLY_B = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "SO2" / "SO2_Monthly_ZonalStats" / "SO2_Monthly_ZonalStats_Barrios"
)
REPO_GEOJSON_SO2_MONTHLY_M = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "SO2" / "SO2_Monthly_ZonalStats" / "SO2_Monthly_ZonalStats_Manzanas"
)
REPO_GEOJSON_SO2_YEARLY_B = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "SO2" / "SO2_Yearly_ZonalStats" / "SO2_Yearly_ZonalStats_Barrios"
)
REPO_GEOJSON_SO2_YEARLY_M = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "SO2" / "SO2_Yearly_ZonalStats" / "SO2_Yearly_ZonalStats_Manzanas"
)
DRIVE_NO2_RASTER_MONTHLY = "NO2_Monthly"
DRIVE_NO2_RASTER_YEARLY = "NO2_Yearly"
DRIVE_NO2_RASTER_TREND = "NO2_Trend"
DRIVE_NO2_CSV_MONTHLY = DRIVE_NO2_RASTER_MONTHLY
DRIVE_NO2_CSV_YEARLY = DRIVE_NO2_RASTER_YEARLY
DRIVE_NO2_GEO_MONTHLY_B = "NO2_Monthly_ZonalStats_Barrios"
DRIVE_NO2_GEO_MONTHLY_M = "NO2_Monthly_ZonalStats_Manzanas"
DRIVE_NO2_GEO_YEARLY_B = "NO2_Yearly_ZonalStats_Barrios"
DRIVE_NO2_GEO_YEARLY_M = "NO2_Yearly_ZonalStats_Manzanas"
DRIVE_NO2_GEO_TREND_B = DRIVE_NO2_GEO_YEARLY_B
DRIVE_NO2_GEO_TREND_M = DRIVE_NO2_GEO_YEARLY_M
DRIVE_SO2_RASTER_MONTHLY = "SO2_Monthly"
DRIVE_SO2_RASTER_YEARLY = "SO2_Yearly"
DRIVE_SO2_RASTER_TREND = "SO2_Trend"
DRIVE_SO2_CSV_MONTHLY = DRIVE_SO2_RASTER_MONTHLY
DRIVE_SO2_CSV_YEARLY = DRIVE_SO2_RASTER_YEARLY
DRIVE_SO2_GEO_MONTHLY_B = "SO2_Monthly_ZonalStats_Barrios"
DRIVE_SO2_GEO_MONTHLY_M = "SO2_Monthly_ZonalStats_Manzanas"
DRIVE_SO2_GEO_YEARLY_B = "SO2_Yearly_ZonalStats_Barrios"
DRIVE_SO2_GEO_YEARLY_M = "SO2_Yearly_ZonalStats_Manzanas"
DRIVE_SO2_GEO_TREND_B = DRIVE_SO2_GEO_YEARLY_B
DRIVE_SO2_GEO_TREND_M = DRIVE_SO2_GEO_YEARLY_M

# --- Huella Urbana (S1+S2 RF classification) ---
ASSET_HU_YEARLY = "users/plataformagenius/Huella_Urbana/Huella_Urbana_Yearly"
DRIVE_HU_YEARLY = "Huella_Urbana_Yearly"
REPO_RASTER_HU_YEARLY = PROJECT_ROOT / "assets" / "data" / "raster" / "Huella_Urbana"
REPO_CSV_HU = PROJECT_ROOT / "assets" / "data" / "csv"

# --- LST (Landsat L8+L9) ---
ASSET_LST_YEARLY = (
    "users/plataformagenius/Temperatura_Superficial/LST_V2/LST_Yearly"
)
REPO_RASTER_LST_MONTHLY = PROJECT_ROOT / "assets" / "data" / "raster" / "LST" / "LST_Monthly"
REPO_RASTER_LST_YEARLY = PROJECT_ROOT / "assets" / "data" / "raster" / "LST" / "LST_Yearly"
REPO_RASTER_LST_TREND = PROJECT_ROOT / "assets" / "data" / "raster" / "LST" / "LST_Trend"
REPO_GEOJSON_LST_MONTHLY_B = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "LST" / "LST_Monthly_ZonalStats_Barrios"
)
REPO_GEOJSON_LST_MONTHLY_M = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "LST" / "LST_Monthly_ZonalStats_Manzanas"
)
REPO_GEOJSON_LST_YEARLY_B = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "LST" / "LST_Yearly_ZonalStats_Barrios"
)
REPO_GEOJSON_LST_YEARLY_M = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "LST" / "LST_Yearly_ZonalStats_Manzanas"
)
DRIVE_LST_RASTER_MONTHLY = "LST_Monthly"
DRIVE_LST_RASTER_YEARLY = "LST_Yearly"
DRIVE_LST_RASTER_TREND = "LST_Trend"
DRIVE_LST_CSV_MONTHLY = DRIVE_LST_RASTER_MONTHLY
DRIVE_LST_CSV_YEARLY = DRIVE_LST_RASTER_YEARLY
DRIVE_LST_GEO_MONTHLY_B = "LST_Monthly_ZonalStats_Barrios"
DRIVE_LST_GEO_MONTHLY_M = "LST_Monthly_ZonalStats_Manzanas"
DRIVE_LST_GEO_YEARLY_B = "LST_Yearly_ZonalStats_Barrios"
DRIVE_LST_GEO_YEARLY_M = "LST_Yearly_ZonalStats_Manzanas"
DRIVE_LST_GEO_TREND_B = DRIVE_LST_GEO_YEARLY_B
DRIVE_LST_GEO_TREND_M = DRIVE_LST_GEO_YEARLY_M
DRIVE_LST_SUHI_YEARLY = "LST_SUHI_Yearly"
REPO_GEOJSON_LST_SUHI_YEARLY = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "LST" / "LST_SUHI_Yearly"
)
