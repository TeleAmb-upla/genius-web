"""
Rutas del repositorio (relativas a la raíz del proyecto) y nombres de carpeta en Google Drive.

Earth Engine solo admite un nombre de carpeta de Drive por exportación (sin subrutas).
Tras completar las tareas en https://code.earthengine.google.com/tasks , descarga los
archivos y colócalos en las rutas REPO_* indicadas para que coincidan con el front-end.

Flujo encolado + espera + descarga: python -m scripts.gee.pipeline
Solo descarga desde Drive: python -m scripts.gee.download_drive_to_repo
(ambos usan las credenciales de earthengine authenticate).
"""
import os
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]

# Proyecto de Google Cloud para la API de Earth Engine (ee.Initialize).
# Si EARTH_ENGINE_PROJECT existe pero está vacío, se ignora y se usa el default.
EE_CLOUD_PROJECT = (os.environ.get("EARTH_ENGINE_PROJECT") or "").strip() or "ee-plataformagenius"

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

# Trend_NDVI_ZonalStats_*.geojson → mismas carpetas que yearly zonal (lo espera el front-end).
REPO_GEOJSON_NDVI_TREND_B = REPO_GEOJSON_NDVI_YEARLY_B
REPO_GEOJSON_NDVI_TREND_M = REPO_GEOJSON_NDVI_YEARLY_M

# --- Carpetas en Google Drive (crear vacías o EE las crea al exportar) ---
DRIVE_RASTER_MONTHLY = "NDVI_Monthly"
# Composites anuales NDVI_Yearly_YYYY.tif → REPO_RASTER_NDVI_YEARLY
DRIVE_RASTER_YEARLY = "NDVI_Yearly"
DRIVE_RASTER_TREND = "NDVI_Yearly"
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
DRIVE_GEO_TREND_M = "NDVI_Yearly_ZonalStats_Manzanas"

# Asset intermedio (colección año-mes) — igual que en Code Editor JS
ASSET_NDVI_YEARMONTH = "users/plataformagenius/Areas_Verdes/NDVI/NDVI_YearMonth"
