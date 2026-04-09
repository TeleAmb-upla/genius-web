"""FeatureCollections de Earth Engine (mismos IDs que los scripts JS)."""
import importlib

# Importar ee explícitamente para evitar conflicto con carpeta local ee/
ee = importlib.import_module("ee")

from ..config import paths


def region_valparaiso() -> ee.FeatureCollection:
    return ee.FeatureCollection(
        "users/plataformagenius/Vectores/Division_Administrativa/Region_Valparaiso"
    )


def gran_valparaiso() -> ee.FeatureCollection:
    return ee.FeatureCollection(
        "users/plataformagenius/Vectores/Division_Administrativa/Gran_Valparaiso"
    )


def distritos_urbanos() -> ee.FeatureCollection:
    return ee.FeatureCollection(
        "users/plataformagenius/Vectores/Division_Administrativa/Distritos_Urbanos"
    )


def area_urbana_feature() -> ee.Feature:
    du = distritos_urbanos()
    combined = du.geometry().dissolve()
    return ee.Feature(combined)


def area_urbana_as_collection() -> ee.FeatureCollection:
    """Una sola geometría urbana como FeatureCollection (reduceRegions)."""
    return ee.FeatureCollection([area_urbana_feature()])


def comuna_quilpue() -> ee.FeatureCollection:
    return ee.FeatureCollection(
        "users/plataformagenius/Vectores/Division_Administrativa/Comuna_Quilpue2017"
    )


def area_urbana_quilpue_feature() -> ee.Feature:
    """
    Área urbana de Quilpué: distritos urbanos recortados a la comuna
    (no toda la Gran Valparaíso ni el polígono completo de la comuna rural).
    """
    comuna = comuna_quilpue()
    urban = distritos_urbanos()
    urban_quil = urban.filterBounds(comuna.geometry())
    geom = urban_quil.geometry().dissolve()
    return ee.Feature(geom)


def area_urbana_quilpue_as_collection() -> ee.FeatureCollection:
    """Una sola geometría: área urbana Quilpué (reduceRegions / clip LST)."""
    return ee.FeatureCollection([area_urbana_quilpue_feature()])


def lst_landsat_region_fc() -> ee.FeatureCollection:
    """FeatureCollection para filterBounds y compuestos LST (área urbana Quilpué)."""
    return area_urbana_quilpue_as_collection()


def barrios_quilpue() -> ee.FeatureCollection:
    return ee.FeatureCollection(
        "users/plataformagenius/Vectores/Division_Administrativa/Barrios_Quilpue"
    )


def manzanas_quilpue() -> ee.FeatureCollection:
    return ee.FeatureCollection(
        "users/plataformagenius/Vectores/Division_Administrativa/ManzanasD_C17"
    )


def areas_verdes() -> ee.FeatureCollection:
    return ee.FeatureCollection(
        "users/plataformagenius/Vectores/Areas_Verdes/AV_Oficiales/AV_Oficial_FINAL"
    )


def ndvi_yearmonth_collection() -> ee.ImageCollection:
    return ee.ImageCollection(
        "users/plataformagenius/Areas_Verdes/NDVI/NDVI_YearMonth"
    )


def aod_yearmonth_collection() -> ee.ImageCollection:
    return ee.ImageCollection(paths.ASSET_AOD_YEARMONTH)


def _ensure_yearly_time_start(image: ee.Image) -> ee.Image:
    """Normaliza yearly assets antiguos que no traen ``system:time_start``."""
    image = ee.Image(image)
    prop_names = image.propertyNames()
    year = ee.Number(image.get("year")).toInt()
    millis = ee.Algorithms.If(
        prop_names.contains("system:time_start"),
        image.get("system:time_start"),
        ee.Date.fromYMD(year, 1, 1).millis(),
    )
    return image.set("year", year).set("system:time_start", millis)


def lst_yearly_collection() -> ee.ImageCollection:
    return ee.ImageCollection(paths.ASSET_LST_YEARLY).map(_ensure_yearly_time_start)
