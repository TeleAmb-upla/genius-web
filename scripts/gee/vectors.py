"""FeatureCollections de Earth Engine (mismos IDs que los scripts JS)."""
import ee

from . import paths


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


def no2_yearmonth_collection() -> ee.ImageCollection:
    return ee.ImageCollection(paths.ASSET_NO2_YEARMONTH)


def so2_yearmonth_collection() -> ee.ImageCollection:
    return ee.ImageCollection(paths.ASSET_SO2_YEARMONTH)


def lst_yearmonth_collection() -> ee.ImageCollection:
    return ee.ImageCollection(paths.ASSET_LST_YEARMONTH)
