"""
Rutas del repositorio (relativas a la raíz del proyecto) y nombres de carpeta en Google Drive.

Google Drive vs Earth Engine (Assets)
-------------------------------------
Las exportaciones ``Export.image.toDrive`` / ``Export.table.toDrive`` **no** escriben en
el árbol de *Assets* de GEE (``users/...``). Escriben en **Google Drive**, en la cuenta
asociada a ``earthengine authenticate`` (típicamente **Mi unidad**).

* Cada constante ``DRIVE_*`` es el **nombre de una carpeta** (un solo segmento, sin
  ``/``). Earth Engine crea la carpeta bajo la raíz de esa unidad si aún no existe.
* Para encontrar los archivos: abre https://drive.google.com → **Mi unidad** → busca el
  nombre exacto (p. ej. ``NDVI_Monthly``, ``NO2_Yearly_ZonalStats_Barrios``). Si en la
  pestaña *Tasks* del Code Editor el enlace “abrir en Drive” no funciona, usa la búsqueda
  en Drive con ese mismo nombre.
* El script de descarga busca carpetas por **nombre exacto**. Si existen varias carpetas
  con el mismo nombre, la API usa la primera coincidencia (ver aviso en consola).

Las rutas ``REPO_*`` son **solo locales** en este repositorio; no son el destino de EE.

Earth Engine admite un nombre de carpeta por exportación (no una ruta anidada tipo
``Padre/Hijo`` en un solo string).

Tras completar las tareas en https://code.earthengine.google.com/tasks , descarga los
archivos y colócalos en las rutas REPO_* indicadas para que coincidan con el front-end.

Flujo encolado + espera + descarga: python -m scripts.gee.pipeline
Solo descarga desde Drive: python -m scripts.gee.drive.download_drive_to_repo
(ambos usan las credenciales de earthengine authenticate).

Cuando bajan CSV/tablas al repo, el pipeline y la descarga Drive regeneran
``assets/js/genius_map_catalog.generated.js`` (años por producto y título de
iluminación leído de ``illumination_front_catalog.json``) vía
``python -m scripts.gee.lib.genius_frontend_catalog``.
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

REPO_GEOJSON_NDVI_MONTHLY_B = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "NDVI" / "NDVI_Monthly_ZonalStats" / "NDVI_Monthly_ZonalStats_Barrios"
)
REPO_GEOJSON_NDVI_MONTHLY_M = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "NDVI" / "NDVI_Monthly_ZonalStats" / "NDVI_Monthly_ZonalStats_Manzanas"
)
REPO_GEOJSON_NDVI_YEARLY_B = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "NDVI" / "NDVI_Yearly_ZonalStats" / "NDVI_Yearly_ZonalStats_Barrios"
)
REPO_GEOJSON_NDVI_YEARLY_M = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "NDVI" / "NDVI_Yearly_ZonalStats" / "NDVI_Yearly_ZonalStats_Manzanas"
)
REPO_GEOJSON_NDVI_SD = PROJECT_ROOT / "assets" / "data" / "geojson" / "NDVI" / "NDVI_SD_ZonalStats"

# Trend_NDVI_ZonalStats_*.geojson: el front sigue leyendo desde estas rutas locales
# (barrios en carpeta yearly B; manzanas igual que yearly M).
REPO_GEOJSON_NDVI_TREND_B = REPO_GEOJSON_NDVI_YEARLY_B
REPO_GEOJSON_NDVI_TREND_M = REPO_GEOJSON_NDVI_YEARLY_M

# --- Carpetas en Google Drive (crear vacías o EE las crea al exportar) ---
# Ubicación real: Google Drive de la cuenta EE → Mi unidad → carpeta con este nombre.
DRIVE_RASTER_MONTHLY = "NDVI_Monthly"
# Solo NDVI_Yearly_YYYY.tif → REPO_RASTER_NDVI_YEARLY (no mezclar con tendencia).
DRIVE_RASTER_YEARLY = "NDVI_Yearly"
# Solo NDVI_Yearly_Trend.tif (Mann–Kendall + Sen) → REPO_RASTER_NDVI_TREND.
DRIVE_RASTER_TREND = "NDVI_Trend"
DRIVE_RASTER_SD = "NDVI_StdDev"

# CSV NDVI -> REPO_CSV (compartido con otros CSV del sitio).
# Mensual: NDVI_m_av, NDVI_m_urban, NDVI_m_zonal_barrios |
# Anual: NDVI_y_av, NDVI_y_urban, NDVI_y_zonal_barrios (csv_tasks.py).
# Tras sync clave ``csv`` (download_drive_to_repo) se regenera NDVI_zonal_explorer_*.json.
# Año-mes: tabla Year, Month, NDVI (urbano) → REPO_NDVI_YEARMONTH_CSV.
DRIVE_CSV_MONTHLY = "NDVI_Monthly"
DRIVE_CSV_YEARLY = "NDVI_Yearly"
DRIVE_CSV_YEARMONTH = "NDVI_YearMonth"

DRIVE_GEO_MONTHLY_B = "NDVI_Monthly_ZonalStats_Barrios"
DRIVE_GEO_MONTHLY_M = "NDVI_Monthly_ZonalStats_Manzanas"
DRIVE_GEO_YEARLY_B = "NDVI_Yearly_ZonalStats_Barrios"
DRIVE_GEO_YEARLY_M = "NDVI_Yearly_ZonalStats_Manzanas"
DRIVE_GEO_SD_AV = "NDVI_SD_ZonalStats"
DRIVE_GEO_TREND_B = DRIVE_GEO_YEARLY_B
DRIVE_GEO_TREND_M = DRIVE_GEO_YEARLY_M

# Asset intermedio (colección año-mes) — igual que en Code Editor JS
ASSET_NDVI_YEARMONTH = "users/plataformagenius/Areas_Verdes/NDVI/NDVI_YearMonth"

# --- AOD (MODIS) ---
ASSET_AOD_YEARMONTH = "users/plataformagenius/Calidad_de_Aire/AOD/AOD_YearMonth"
REPO_RASTER_AOD_MONTHLY = PROJECT_ROOT / "assets" / "data" / "raster" / "AOD" / "AOD_Monthly"
REPO_RASTER_AOD_YEARLY = PROJECT_ROOT / "assets" / "data" / "raster" / "AOD" / "AOD_Yearly"
REPO_RASTER_AOD_TREND = PROJECT_ROOT / "assets" / "data" / "raster" / "AOD" / "AOD_Trend"
REPO_CSV_AOD = REPO_CSV
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
REPO_CSV_NO2 = REPO_CSV
REPO_CSV_SO2 = REPO_CSV
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

# --- LST (ImageCollection año–mes en GEE; anual derivado = mediana mensual por año) ---
ASSET_LST_YEARMONTH = (
    "users/plataformagenius/Temperatura_Superficial/LST/LST_YearMonth"
)
REPO_RASTER_LST_MONTHLY = PROJECT_ROOT / "assets" / "data" / "raster" / "LST" / "LST_Monthly"
REPO_RASTER_LST_YEARLY = PROJECT_ROOT / "assets" / "data" / "raster" / "LST" / "LST_Yearly"
REPO_RASTER_LST_TREND = PROJECT_ROOT / "assets" / "data" / "raster" / "LST" / "LST_Trend"
REPO_CSV_LST = REPO_CSV
REPO_GEOJSON_LST_MONTHLY_B = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "LST" / "LST_Monthly_ZonalStats" / "LST_Monthly_ZonalStats_Barrios"
)
REPO_GEOJSON_LST_MONTHLY_M = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "LST" / "LST_Monthly_ZonalStats" / "LST_Monthly_ZonalStats_Manzanas"
)
REPO_GEOJSON_LST_YEARLY_B = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "LST" / "LST_Yearly_ZonalStats" / "LST_Yearly_ZonalStats_Barrios"
)
REPO_GEOJSON_LST_YEARLY_M = (
    PROJECT_ROOT / "assets" / "data" / "geojson" / "LST" / "LST_Yearly_ZonalStats" / "LST_Yearly_ZonalStats_Manzanas"
)
DRIVE_LST_RASTER_MONTHLY = "LST_Monthly"
DRIVE_LST_RASTER_YEARLY = "LST_Yearly"
DRIVE_LST_RASTER_TREND = "LST_Trend"
DRIVE_LST_CSV_MONTHLY = DRIVE_LST_RASTER_MONTHLY
DRIVE_LST_CSV_YEARLY = DRIVE_LST_RASTER_YEARLY
# Tras sync ``lst_csv_monthly`` / ``lst_csv_yearly`` (download_drive_to_repo) se regenera
# LST_zonal_explorer_*.json vía scripts/repo/bundles/build_lst_zonal_explorer_bundle.py.
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

# --- Paquete GEE (scripts/gee/): JSON de estado incremental por producto ---
GEE_PACKAGE_ROOT = Path(__file__).resolve().parents[1]
EXPORT_STATE_DIR = GEE_PACKAGE_ROOT / "state"


def export_state_path(filename: str) -> Path:
    """
    Ruta estable al JSON de estado bajo ``scripts/gee/state/``.

    Si aún existe el archivo en la raíz legacy ``scripts/gee/`` (layout antiguo),
    lo mueve una sola vez al subdirectorio ``state/``.
    """
    new_p = EXPORT_STATE_DIR / filename
    if new_p.is_file():
        return new_p
    legacy = GEE_PACKAGE_ROOT / filename
    if legacy.is_file():
        EXPORT_STATE_DIR.mkdir(parents=True, exist_ok=True)
        legacy.rename(new_p)
        return new_p
    return new_p
