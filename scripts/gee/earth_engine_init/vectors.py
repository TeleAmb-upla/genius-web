"""FeatureCollections de Earth Engine (mismos IDs que los scripts JS)."""
import importlib

# Importar ee explícitamente para evitar conflicto con carpeta local ee/
ee = importlib.import_module("ee")

from ..config import paths
from ..products.lst.constants import LST_NULL_SERIES_YEARS


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


def _ensure_lst_yearmonth_props(image: ee.Image) -> ee.Image:
    """Normaliza ``year`` / ``month`` / ``system:time_start`` en imágenes LST año–mes."""
    image = ee.Image(image)
    year = ee.Number(image.get("year")).toInt()
    month = ee.Number(image.get("month")).toInt()
    prop_names = image.propertyNames()
    millis = ee.Algorithms.If(
        prop_names.contains("system:time_start"),
        image.get("system:time_start"),
        ee.Date.fromYMD(year, month, 1).millis(),
    )
    return image.set("year", year).set("month", month).set("system:time_start", millis)


def lst_yearmonth_collection() -> ee.ImageCollection:
    ic = ee.ImageCollection(paths.ASSET_LST_YEARMONTH).map(_ensure_lst_yearmonth_props)
    dead = sorted(LST_NULL_SERIES_YEARS)
    if not dead:
        return ic
    flt = ee.Filter.And(*[ee.Filter.neq("year", int(y)) for y in dead])
    return ic.filter(flt)


def _lst_year_median_image(
    ic_ym: ee.ImageCollection, y: ee.Number, region: ee.Geometry
) -> ee.Image:
    y_int = ee.Number(y).toInt()
    return (
        ic_ym.filter(ee.Filter.eq("year", y_int))
        .select("LST_mean")
        .median()
        .rename("LST_mean")
        .clip(region)
        .set("year", y_int)
        .set("system:time_start", ee.Date.fromYMD(y_int, 1, 1).millis())
    )


def lst_yearly_collection() -> ee.ImageCollection:
    """
    Compuesto anual derivado: mediana de todas las imágenes ``LST_YearMonth`` del año,
    recortada al área urbana Quilpué (misma geometría que antes con Landsat).
    """
    ic_ym = lst_yearmonth_collection()
    region = lst_landsat_region_fc().geometry()
    years = ic_ym.aggregate_array("year").distinct().sort()

    def _one_year(y) -> ee.Image:
        return _lst_year_median_image(ic_ym, ee.Number(y), region)

    return ee.ImageCollection.fromImages(years.map(_one_year)).map(
        _ensure_yearly_time_start
    )
