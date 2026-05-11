"""
Percentiles de climatología mensual (P25 / P50 / P75) a partir de una imagen
por año y mes: para cada mes calendario se toma la distribución de la **mediana
regional** (P50 espacial sobre la geometría) entre años y se exportan los
cuantiles. Así el valor central y ``anio_actual`` son coherentes con P25/P50/P75.
"""
from __future__ import annotations

from typing import Callable

import ee

# Valor sentinela cuando no hay muestras para percentiles (colección vacía o todo null).
# Evita ``Number.format: Parameter 'number' is required and may not be null`` en EXPORT_FEATURES.
_PCT_CSV_SENTINEL = -9999.0


def _scalar_median_ndvi_image_geometry(
    img: ee.Image,
    geometry: ee.Geometry,
    *,
    band: str = "NDVI_median",
    scale: float = 10.0,
) -> ee.Feature:
    """
    Mediana espacial (P50 zonal) de ``band`` sobre una geometría, alineada a las
    columnas P25/P50/P75 del CSV mensual.
    """
    im = ee.Image(img).select(band)
    stat = im.reduceRegion(
        reducer=ee.Reducer.median(),
        geometry=geometry,
        scale=scale,
        maxPixels=10_000_000_000,
        tileScale=4,
        bestEffort=True,
    )
    d = ee.Dictionary(stat)
    names = d.keys()
    key_named = f"{band}_median"
    raw = ee.Algorithms.If(
        names.contains(key_named),
        d.get(key_named),
        ee.Algorithms.If(
            names.contains("median"),
            d.get("median"),
            ee.Algorithms.If(names.contains(band), d.get(band), None),
        ),
    )
    return ee.Feature(None, {"v": raw})


def _percentile_dict_with_fallback(vals: ee.FeatureCollection) -> ee.Dictionary:
    """
    ``reduceColumns`` con percentiles sobre 0 filas puede devolver p25/p50/p75 nulos;
    ``ee.Number(null).format`` rompe la exportación a CSV.
    """
    n = vals.size()
    fallback = ee.Dictionary(
        {"p25": _PCT_CSV_SENTINEL, "p50": _PCT_CSV_SENTINEL, "p75": _PCT_CSV_SENTINEL}
    )
    # reduceColumns solo en la rama no vacía (If evalúa una sola rama en el servidor).
    reduced = ee.Dictionary(
        vals.reduceColumns(
            reducer=ee.Reducer.percentile([25, 50, 75]),
            selectors=["v"],
        )
    )
    return ee.Dictionary(ee.Algorithms.If(n.eq(0), fallback, reduced))


def _feature_regional_median(
    img: ee.Image,
    region: ee.FeatureCollection,
    scale: float,
    band: str,
    max_pixels: int = 10_000_000_000_000,
    tile_scale: int = 2,
) -> ee.Feature:
    # Posicional: evita que versiones raras de la API confundan kwargs con ``maxPixels``.
    fc = img.reduceRegions(
        region,
        ee.Reducer.median(),
        scale,
        None,
        None,
        tile_scale,
        max_pixels,
    )
    feat = fc.first()
    names = feat.propertyNames()
    key_named = f"{band}_median"
    v = ee.Algorithms.If(
        names.contains(key_named),
        feat.get(key_named),
        ee.Algorithms.If(
            names.contains("median"),
            feat.get("median"),
            ee.Algorithms.If(
                names.contains(f"{band}_mean"),
                feat.get(f"{band}_mean"),
                feat.get("mean"),
            ),
        ),
    )
    return ee.Feature(None, {"v": v})


def _lst_urban_median_one_feature(
    img: ee.Image,
    urban_fc: ee.FeatureCollection,
    scale: float,
    max_pixels: int = 10_000_000_000_000,
    tile_scale: int = 4,
) -> ee.Feature:
    """Mediana espacial LST sobre el urbano (misma geometría que climatología mensual)."""
    stat = img.reduceRegion(
        reducer=ee.Reducer.median(),
        geometry=urban_fc.geometry(),
        scale=scale,
        maxPixels=max_pixels,
        tileScale=tile_scale,
        bestEffort=True,
    )
    d = ee.Dictionary(stat)
    names = d.keys()
    raw = ee.Algorithms.If(
        names.contains("LST_mean_median"),
        d.get("LST_mean_median"),
        ee.Algorithms.If(
            names.contains("median"),
            d.get("median"),
            ee.Algorithms.If(
                names.contains("LST_mean"),
                d.get("LST_mean"),
                None,
            ),
        ),
    )
    return ee.Feature(None, {"v": raw})


def reduce_single_year_month_median_from_yearmonth_ic(
    ic: ee.ImageCollection,
    *,
    month: ee.Number,
    year: ee.Number,
    source_band: str,
    region: ee.FeatureCollection,
    scale: float,
    image_prep: Callable[[ee.Image], ee.Image] | None = None,
    reduce_band: str | None = None,
) -> ee.Number:
    """
    Una sola mediana inter-imagen para (year, month) en una colección año–mes
    (p. ej. todas las imágenes de enero 2026): misma geometría que la climatología.
    """
    m = ee.Number(month)
    y = ee.Number(year)
    sub = (
        ic.filter(ee.Filter.eq("month", m))
        .filter(ee.Filter.eq("year", y))
        .select(source_band)
    )
    rb = reduce_band or source_band

    def per_img(im: ee.Image) -> ee.Feature:
        im = ee.Image(im)
        if image_prep is not None:
            im = image_prep(im)
        return _feature_regional_median(im, region, scale, rb)

    vals = ee.FeatureCollection(sub.map(per_img)).filter(ee.Filter.notNull(["v"]))
    d = _percentile_dict_with_fallback(vals)
    return ee.Number(d.get("p50"))


def reduce_monthly_percentiles_from_yearmonth_ic(
    ic: ee.ImageCollection,
    *,
    month: ee.Number,
    source_band: str,
    region: ee.FeatureCollection,
    scale: float,
    image_prep: Callable[[ee.Image], ee.Image] | None = None,
    reduce_band: str | None = None,
) -> ee.Dictionary:
    """
    Filtra ``ic`` por ``month`` (propiedad ``month``), opcionalmente transforma
    cada imagen con ``image_prep``, y reduce a una mediana regional por año-mes.
    Devuelve un ``ee.Dictionary`` con claves p25, p50, p75 (resultado de
    ``reduceColumns``).
    """
    m = ee.Number(month)
    sub = ic.filter(ee.Filter.eq("month", m)).select(source_band)

    rb = reduce_band or source_band

    def per_img(im: ee.Image) -> ee.Feature:
        im = ee.Image(im)
        if image_prep is not None:
            im = image_prep(im)
        return _feature_regional_median(im, region, scale, rb)

    vals = ee.FeatureCollection(sub.map(per_img)).filter(ee.Filter.notNull(["v"]))
    return _percentile_dict_with_fallback(vals)


def lst_wall_year_month_median_urban(
    landsat: ee.ImageCollection,
    *,
    month: ee.Number,
    wall_year: int,
    wall_month: int,
    region: ee.FeatureCollection,
    scale: float,
) -> ee.Number:
    """Mediana LST urbana del mes en el año calendario de referencia (Python)."""
    m = ee.Number(month)
    wy = ee.Number(int(wall_year))
    wm = ee.Number(int(wall_month))
    subset = landsat.filter(ee.Filter.calendarRange(m, m, "month")).filter(
        ee.Filter.calendarRange(wy, wy, "year")
    )
    has_data = subset.size().gt(0)
    composite = subset.select("LST_mean").median().clip(region.geometry())
    no_obs = (
        ee.Image.constant(_PCT_CSV_SENTINEL)
        .float()
        .rename("LST_mean")
        .updateMask(ee.Image.constant(0.0))
    )
    img = ee.Image(ee.Algorithms.If(has_data, composite, no_obs))
    stat = img.reduceRegion(
        reducer=ee.Reducer.median(),
        geometry=region.geometry(),
        scale=scale,
        maxPixels=1e13,
        tileScale=4,
        bestEffort=True,
    )
    d = ee.Dictionary(stat)
    names = d.keys()
    mu = ee.Number(
        ee.Algorithms.If(
            names.contains("LST_mean_median"),
            d.get("LST_mean_median"),
            ee.Algorithms.If(
                names.contains("median"),
                d.get("median"),
                d.get("LST_mean"),
            ),
        )
    )
    return ee.Number(ee.Algorithms.If(m.gt(wm), ee.Number(_PCT_CSV_SENTINEL), mu))


def lst_monthly_percentile_row(
    landsat: ee.ImageCollection,
    *,
    month: ee.Number,
    years: ee.List,
    region: ee.FeatureCollection,
    scale: float,
    wall_year: int,
    wall_month: int,
) -> ee.Feature:
    """Una fila CSV LST con LST_mean (P50), LST_p25, LST_p75 y anio_actual."""
    m = ee.Number(month)

    def for_year(y: ee.ComputedObject) -> ee.Feature:
        y = ee.Number(y)
        subset = landsat.filter(ee.Filter.calendarRange(m, m, "month")).filter(
            ee.Filter.calendarRange(y, y, "year")
        )
        # Colección vacía → .median() es imagen sin bandas y reduceRegions falla.
        has_data = subset.size().gt(0)
        composite = subset.select("LST_mean").median().clip(region.geometry())
        no_obs = (
            ee.Image.constant(0.0)
            .float()
            .rename("LST_mean")
            .updateMask(ee.Image.constant(0.0))
        )
        img = ee.Image(ee.Algorithms.If(has_data, composite, no_obs))
        return _lst_urban_median_one_feature(img, region, scale)

    vals = ee.FeatureCollection(years.map(for_year)).filter(ee.Filter.notNull(["v"]))
    d = _percentile_dict_with_fallback(vals)
    curr = lst_wall_year_month_median_urban(
        landsat,
        month=m,
        wall_year=wall_year,
        wall_month=wall_month,
        region=region,
        scale=scale,
    )
    return ee.Feature(
        None,
        {
            "Month": m,
            "LST_mean": ee.Number(d.get("p50")).format("%.6f"),
            "LST_p25": ee.Number(d.get("p25")).format("%.6f"),
            "LST_p75": ee.Number(d.get("p75")).format("%.6f"),
            "anio_actual": curr.format("%.6f"),
        },
    )


def lst_zonal_unit_month_row(
    landsat: ee.ImageCollection,
    *,
    month: ee.Number,
    unit_fc: ee.FeatureCollection,
    id_prop: str,
    years: ee.List,
    wall_year: int,
    wall_month: int,
    scale: float,
) -> ee.Feature:
    """
    Una fila estilo ``LST_m_urban`` (P25/P50/P75 + ``anio_actual``) por barrio o manzana,
    desde la colección Landsat (misma lógica que ``lst_monthly_percentile_row`` pero con
    geometría de la entidad zonal).
    """
    m = ee.Number(month)
    wy = ee.Number(int(wall_year))
    wm = ee.Number(int(wall_month))

    def for_year(y: ee.ComputedObject) -> ee.Feature:
        y = ee.Number(y)
        subset = landsat.filter(ee.Filter.calendarRange(m, m, "month")).filter(
            ee.Filter.calendarRange(y, y, "year")
        )
        has_data = subset.size().gt(0)
        composite = subset.select("LST_mean").median().clip(unit_fc.geometry())
        no_obs = (
            ee.Image.constant(0.0)
            .float()
            .rename("LST_mean")
            .updateMask(ee.Image.constant(0.0))
        )
        img = ee.Image(ee.Algorithms.If(has_data, composite, no_obs))
        return _lst_urban_median_one_feature(img, unit_fc, scale)

    vals = ee.FeatureCollection(years.map(for_year)).filter(ee.Filter.notNull(["v"]))
    d = _percentile_dict_with_fallback(vals)
    curr = lst_wall_year_month_median_urban(
        landsat,
        month=m,
        wall_year=wall_year,
        wall_month=wall_month,
        region=unit_fc,
        scale=scale,
    )
    feat = unit_fc.first()
    p50 = ee.Number(d.get("p50"))
    p25 = ee.Number(d.get("p25"))
    p75 = ee.Number(d.get("p75"))
    if id_prop == "NOMBRE":
        return ee.Feature(
            None,
            {
                "NOMBRE": feat.get("NOMBRE"),
                "Month": m,
                "LST_mean": p50.format("%.6f"),
                "LST_p25": p25.format("%.6f"),
                "LST_p75": p75.format("%.6f"),
                "anio_actual": curr.format("%.6f"),
            },
        )
    return ee.Feature(
        None,
        {
            "MANZENT": feat.get("MANZENT"),
            "Month": m,
            "LST_mean": p50.format("%.6f"),
            "LST_p25": p25.format("%.6f"),
            "LST_p75": p75.format("%.6f"),
            "anio_actual": curr.format("%.6f"),
        },
    )


def lst_urban_month_row_from_yearmonth_ic(
    ic_ym: ee.ImageCollection,
    *,
    month: ee.Number,
    region: ee.FeatureCollection,
    wall_year: int,
    wall_month: int,
    scale: float,
) -> ee.Feature:
    """Climatología mensual LST (P25/P50/P75 + ``anio_actual``) desde ``LST_YearMonth``."""
    m = ee.Number(month)
    wy = ee.Number(int(wall_year))
    wm = ee.Number(int(wall_month))
    sub = ic_ym.filter(ee.Filter.eq("month", m)).select("LST_mean")

    def row_u(im: ee.Image) -> ee.Feature:
        return _lst_urban_median_one_feature(ee.Image(im), region, scale)

    vals = ee.FeatureCollection(sub.map(row_u)).filter(ee.Filter.notNull(["v"]))
    d = _percentile_dict_with_fallback(vals)
    sub_y = ic_ym.filter(ee.Filter.eq("month", m)).filter(ee.Filter.eq("year", wy))
    vals_y = ee.FeatureCollection(sub_y.map(row_u)).filter(ee.Filter.notNull(["v"]))
    d_y = _percentile_dict_with_fallback(vals_y)
    raw_curr = ee.Number(d_y.get("p50"))
    curr = ee.Number(ee.Algorithms.If(m.gt(wm), ee.Number(_PCT_CSV_SENTINEL), raw_curr))
    return ee.Feature(
        None,
        {
            "Month": m,
            "LST_mean": ee.Number(d.get("p50")).format("%.6f"),
            "LST_p25": ee.Number(d.get("p25")).format("%.6f"),
            "LST_p75": ee.Number(d.get("p75")).format("%.6f"),
            "anio_actual": curr.format("%.6f"),
        },
    )


def lst_zonal_unit_month_row_from_yearmonth_ic(
    ic_ym: ee.ImageCollection,
    *,
    month: ee.Number,
    unit_fc: ee.FeatureCollection,
    id_prop: str,
    wall_year: int,
    wall_month: int,
    scale: float,
) -> ee.Feature:
    """Fila zonal mensual LST desde colección año–mes (misma lógica que NDVI)."""
    m = ee.Number(month)
    wy = ee.Number(int(wall_year))
    wm = ee.Number(int(wall_month))
    sub = ic_ym.filter(ee.Filter.eq("month", m)).select("LST_mean")

    def row_u(im: ee.Image) -> ee.Feature:
        return _lst_urban_median_one_feature(ee.Image(im), unit_fc, scale)

    vals = ee.FeatureCollection(sub.map(row_u)).filter(ee.Filter.notNull(["v"]))
    d = _percentile_dict_with_fallback(vals)
    sub_y = ic_ym.filter(ee.Filter.eq("month", m)).filter(ee.Filter.eq("year", wy))
    vals_y = ee.FeatureCollection(sub_y.map(row_u)).filter(ee.Filter.notNull(["v"]))
    d_y = _percentile_dict_with_fallback(vals_y)
    raw_curr = ee.Number(d_y.get("p50"))
    curr = ee.Number(ee.Algorithms.If(m.gt(wm), ee.Number(_PCT_CSV_SENTINEL), raw_curr))
    feat = unit_fc.first()
    p50 = ee.Number(d.get("p50"))
    p25 = ee.Number(d.get("p25"))
    p75 = ee.Number(d.get("p75"))
    if id_prop == "NOMBRE":
        return ee.Feature(
            None,
            {
                "NOMBRE": feat.get("NOMBRE"),
                "Month": m,
                "LST_mean": p50.format("%.6f"),
                "LST_p25": p25.format("%.6f"),
                "LST_p75": p75.format("%.6f"),
                "anio_actual": curr.format("%.6f"),
            },
        )
    return ee.Feature(
        None,
        {
            "MANZENT": feat.get("MANZENT"),
            "Month": m,
            "LST_mean": p50.format("%.6f"),
            "LST_p25": p25.format("%.6f"),
            "LST_p75": p75.format("%.6f"),
            "anio_actual": curr.format("%.6f"),
        },
    )


def ndvi_polygon_median_aggregate_feature(
    img: ee.Image,
    fc: ee.FeatureCollection,
    *,
    band: str = "NDVI_median",
) -> ee.Feature:
    """P50 espacial por polígono; luego P50 entre polígonos (coherente con P25/P50/P75 mensual)."""
    stats = ee.Image(img).reduceRegions(
        collection=fc, reducer=ee.Reducer.median(), scale=10
    )
    key_named = f"{band}_median"

    def to_v(feat: ee.ComputedObject) -> ee.Feature:
        feat = ee.Feature(feat)
        names = feat.propertyNames()
        raw = ee.Algorithms.If(
            names.contains(key_named),
            feat.get(key_named),
            ee.Algorithms.If(
                names.contains("median"),
                feat.get("median"),
                ee.Algorithms.If(
                    names.contains(f"{band}_mean"),
                    feat.get(f"{band}_mean"),
                    feat.get("mean"),
                ),
            ),
        )
        return ee.Feature(None, {"v": raw})

    vals = stats.map(to_v).filter(ee.Filter.notNull(["v"]))
    n = vals.size()
    p50_dict = vals.reduceColumns(
        reducer=ee.Reducer.percentile([50]),
        selectors=["v"],
    )
    v_agg = ee.Number(ee.Dictionary(p50_dict).get("p50"))
    v = ee.Algorithms.If(n.gt(0), v_agg, None)
    return ee.Feature(None, {"v": v})


def ndvi_intraannual_monthly_scalar_percentiles(
    s2_ym: ee.ImageCollection,
    *,
    year: ee.Number,
    fc: ee.FeatureCollection,
    band: str = "NDVI_median",
) -> ee.Dictionary:
    """
    Un año civil: P25 / P50 / P75 sobre los NDVI mensuales agregados
    (``ndvi_polygon_median_aggregate_feature``), misma nube de valores que el CSV año–mes
    por zona. Así el valor central (P50) queda siempre entre P25 y P75.
    """
    monthly = s2_ym.filter(ee.Filter.eq("year", year)).select(band)

    def row(im: ee.ComputedObject) -> ee.Feature:
        return ndvi_polygon_median_aggregate_feature(ee.Image(im), fc, band=band)

    vals = monthly.map(row).filter(ee.Filter.notNull(["v"]))
    return _percentile_dict_with_fallback(vals)


def lst_intraannual_monthly_scalar_percentiles(
    ic_ym: ee.ImageCollection,
    *,
    year: ee.Number,
    unit_fc: ee.FeatureCollection,
    scale: float,
) -> ee.Dictionary:
    """
    Un año civil: P25 / P50 / P75 sobre las medianas zonales mensuales de LST
    (``LST_mean`` en ``ic_ym``). Misma idea que ``ndvi_intraannual_monthly_scalar_percentiles``:
    el valor central queda siempre entre P25 y P75.
    """
    monthly = ic_ym.filter(ee.Filter.eq("year", year)).select("LST_mean")

    def row(im: ee.ComputedObject) -> ee.Feature:
        return _lst_urban_median_one_feature(ee.Image(im), unit_fc, scale)

    vals = monthly.map(row).filter(ee.Filter.notNull(["v"]))
    return _percentile_dict_with_fallback(vals)


def ndvi_av_month_row(
    s2_ym: ee.ImageCollection,
    *,
    month: ee.Number,
    gestion_fc: ee.FeatureCollection,
    planificacion_fc: ee.FeatureCollection,
    area_urbana: ee.FeatureCollection,
    wall_year: int,
    wall_month: int,
) -> ee.Feature:
    m = ee.Number(month)
    wy = ee.Number(int(wall_year))
    wm = ee.Number(int(wall_month))
    sub = s2_ym.filter(ee.Filter.eq("month", m)).select("NDVI_median")
    urban_geom = area_urbana.geometry()

    def row_g(im: ee.Image) -> ee.Feature:
        return ndvi_polygon_median_aggregate_feature(im, gestion_fc)

    def row_p(im: ee.Image) -> ee.Feature:
        return ndvi_polygon_median_aggregate_feature(im, planificacion_fc)

    def row_u(im: ee.Image) -> ee.Feature:
        return _scalar_median_ndvi_image_geometry(ee.Image(im), urban_geom)

    def pct(fc: ee.FeatureCollection) -> ee.Dictionary:
        v2 = fc.filter(ee.Filter.notNull(["v"]))
        return _percentile_dict_with_fallback(v2)

    dg = ee.Dictionary(pct(ee.FeatureCollection(sub.map(row_g))))
    dp = ee.Dictionary(pct(ee.FeatureCollection(sub.map(row_p))))
    du = ee.Dictionary(pct(ee.FeatureCollection(sub.map(row_u))))

    sub_y = s2_ym.filter(ee.Filter.eq("month", m)).filter(ee.Filter.eq("year", wy))
    dg_y = ee.Dictionary(pct(ee.FeatureCollection(sub_y.map(row_g))))
    dp_y = ee.Dictionary(pct(ee.FeatureCollection(sub_y.map(row_p))))
    du_y = ee.Dictionary(pct(ee.FeatureCollection(sub_y.map(row_u))))
    gv = ee.Number(dg_y.get("p50"))
    pv = ee.Number(dp_y.get("p50"))
    uv = ee.Number(du_y.get("p50"))
    gv2 = ee.Number(ee.Algorithms.If(m.gt(wm), ee.Number(_PCT_CSV_SENTINEL), gv))
    pv2 = ee.Number(ee.Algorithms.If(m.gt(wm), ee.Number(_PCT_CSV_SENTINEL), pv))
    uv2 = ee.Number(ee.Algorithms.If(m.gt(wm), ee.Number(_PCT_CSV_SENTINEL), uv))

    return ee.Feature(
        None,
        {
            "Month": m,
            "NDVI_Gestion": ee.Number(dg.get("p50")).format("%.2f"),
            "NDVI_Planificacion": ee.Number(dp.get("p50")).format("%.2f"),
            "NDVI_Urbano": ee.Number(du.get("p50")).format("%.2f"),
            "NDVI_Gestion_anio_actual": gv2.format("%.2f"),
            "NDVI_Planificacion_anio_actual": pv2.format("%.2f"),
            "NDVI_Urbano_anio_actual": uv2.format("%.2f"),
        },
    )


def ndvi_urban_month_row(
    s2_ym: ee.ImageCollection,
    *,
    month: ee.Number,
    area_urbana: ee.FeatureCollection,
    wall_year: int,
    wall_month: int,
) -> ee.Feature:
    """
    Misma reducción que el zonal por unidad: ``reduceRegion`` sobre la geometría disuelta
    con ``maxPixels`` / ``bestEffort``. ``reduceRegions`` sobre el polígono urbano grande
    sin esos límites puede devolver todo null y ``anio_actual`` en sentinela.
    """
    m = ee.Number(month)
    wy = ee.Number(int(wall_year))
    wm = ee.Number(int(wall_month))
    sub = s2_ym.filter(ee.Filter.eq("month", m)).select("NDVI_median")
    urban_geom = area_urbana.geometry()

    def row_u(im: ee.Image) -> ee.Feature:
        return _scalar_median_ndvi_image_geometry(ee.Image(im), urban_geom)

    vals = ee.FeatureCollection(sub.map(row_u)).filter(ee.Filter.notNull(["v"]))
    d = _percentile_dict_with_fallback(vals)
    sub_y = s2_ym.filter(ee.Filter.eq("month", m)).filter(ee.Filter.eq("year", wy))
    vals_y = ee.FeatureCollection(sub_y.map(row_u)).filter(ee.Filter.notNull(["v"]))
    d_y = _percentile_dict_with_fallback(vals_y)
    raw_curr = ee.Number(d_y.get("p50"))
    curr = ee.Number(ee.Algorithms.If(m.gt(wm), ee.Number(_PCT_CSV_SENTINEL), raw_curr))
    return ee.Feature(
        None,
        {
            "Month": m,
            "NDVI": ee.Number(d.get("p50")).format("%.4f"),
            "NDVI_p25": ee.Number(d.get("p25")).format("%.4f"),
            "NDVI_p75": ee.Number(d.get("p75")).format("%.4f"),
            "anio_actual": curr.format("%.4f"),
        },
    )


def ndvi_zonal_unit_month_row(
    s2_ym: ee.ImageCollection,
    *,
    month: ee.Number,
    unit_fc: ee.FeatureCollection,
    id_prop: str,
    wall_year: int,
    wall_month: int,
) -> ee.Feature:
    """
    Una fila estilo ``NDVI_m_urban`` (P25/P50/P75 + ``anio_actual``) por barrio o manzana,
    compuesta en GEE desde la colección año–mes (percentiles sobre la mediana zonal por imagen).
    Usa ``reduceRegion`` sobre la geometría de la entidad (equivalente a un solo polígono en
    los GeoJSON zonales).
    """
    m = ee.Number(month)
    wy = ee.Number(int(wall_year))
    wm = ee.Number(int(wall_month))
    geom = unit_fc.geometry()
    sub = s2_ym.filter(ee.Filter.eq("month", m)).select("NDVI_median")

    def row_u(im: ee.Image) -> ee.Feature:
        return _scalar_median_ndvi_image_geometry(ee.Image(im), geom)

    vals = ee.FeatureCollection(sub.map(row_u)).filter(ee.Filter.notNull(["v"]))
    d = _percentile_dict_with_fallback(vals)
    sub_y = s2_ym.filter(ee.Filter.eq("month", m)).filter(ee.Filter.eq("year", wy))
    vals_y = ee.FeatureCollection(sub_y.map(row_u)).filter(ee.Filter.notNull(["v"]))
    d_y = _percentile_dict_with_fallback(vals_y)
    raw_curr = ee.Number(d_y.get("p50"))
    curr = ee.Number(ee.Algorithms.If(m.gt(wm), ee.Number(_PCT_CSV_SENTINEL), raw_curr))
    feat = unit_fc.first()
    p50 = ee.Number(d.get("p50"))
    p25 = ee.Number(d.get("p25"))
    p75 = ee.Number(d.get("p75"))
    if id_prop == "NOMBRE":
        return ee.Feature(
            None,
            {
                "NOMBRE": feat.get("NOMBRE"),
                "Month": m,
                "NDVI": p50.format("%.4f"),
                "NDVI_p25": p25.format("%.4f"),
                "NDVI_p75": p75.format("%.4f"),
                "anio_actual": curr.format("%.4f"),
            },
        )
    return ee.Feature(
        None,
        {
            "MANZENT": feat.get("MANZENT"),
            "Month": m,
            "NDVI": p50.format("%.4f"),
            "NDVI_p25": p25.format("%.4f"),
            "NDVI_p75": p75.format("%.4f"),
            "anio_actual": curr.format("%.4f"),
        },
    )


def pollutant_zonal_unit_month_row(
    ic: ee.ImageCollection,
    *,
    month: ee.Number,
    unit_fc: ee.FeatureCollection,
    id_prop: str,
    wall_year: int,
    wall_month: int,
    scale: float,
    source_band: str,
    export_band: str,
    image_prep: Callable[[ee.Image], ee.Image],
    mid_col: str,
    p25_col: str,
    p75_col: str,
) -> ee.Feature:
    """Fila mensual zonal (barrio/manzana) para NO2/SO2 — misma lógica que NDVI/LST."""
    m = ee.Number(month)
    wy = ee.Number(int(wall_year))
    wm = ee.Number(int(wall_month))
    geom = unit_fc.geometry()
    sub = ic.filter(ee.Filter.eq("month", m)).select(source_band)

    def row_u(im: ee.Image) -> ee.Feature:
        im2 = image_prep(ee.Image(im)).select(export_band)
        stat = im2.reduceRegion(
            reducer=ee.Reducer.median(),
            geometry=geom,
            scale=scale,
            maxPixels=10_000_000_000,
            tileScale=4,
            bestEffort=True,
        )
        d = ee.Dictionary(stat)
        names = d.keys()
        key_med = f"{export_band}_median"
        raw = ee.Algorithms.If(
            names.contains(key_med),
            d.get(key_med),
            ee.Algorithms.If(
                names.contains("median"),
                d.get("median"),
                ee.Algorithms.If(
                    names.contains(f"{export_band}_mean"),
                    d.get(f"{export_band}_mean"),
                    ee.Algorithms.If(
                        names.contains("mean"),
                        d.get("mean"),
                        ee.Algorithms.If(names.contains(export_band), d.get(export_band), None),
                    ),
                ),
            ),
        )
        return ee.Feature(None, {"v": raw})

    vals = ee.FeatureCollection(sub.map(row_u)).filter(ee.Filter.notNull(["v"]))
    d = _percentile_dict_with_fallback(vals)
    sub_y = ic.filter(ee.Filter.eq("month", m)).filter(ee.Filter.eq("year", wy))
    vals_y = ee.FeatureCollection(sub_y.map(row_u)).filter(ee.Filter.notNull(["v"]))
    d_y = _percentile_dict_with_fallback(vals_y)
    raw_curr = ee.Number(d_y.get("p50"))
    curr = ee.Number(ee.Algorithms.If(m.gt(wm), ee.Number(_PCT_CSV_SENTINEL), raw_curr))
    feat = unit_fc.first()
    p50 = ee.Number(d.get("p50"))
    p25 = ee.Number(d.get("p25"))
    p75 = ee.Number(d.get("p75"))
    if id_prop == "NOMBRE":
        return ee.Feature(
            None,
            {
                "NOMBRE": feat.get("NOMBRE"),
                "Month": m,
                mid_col: p50.format("%.6f"),
                p25_col: p25.format("%.6f"),
                p75_col: p75.format("%.6f"),
                "anio_actual": curr.format("%.6f"),
            },
        )
    return ee.Feature(
        None,
        {
            "MANZENT": feat.get("MANZENT"),
            "Month": m,
            mid_col: p50.format("%.6f"),
            p25_col: p25.format("%.6f"),
            p75_col: p75.format("%.6f"),
            "anio_actual": curr.format("%.6f"),
        },
    )


def _median_of_numeric_features(mfc: ee.FeatureCollection, key: str) -> ee.Number:
    n = mfc.size()
    return ee.Algorithms.If(
        n.gt(0),
        ee.Number(
            ee.Dictionary(
                mfc.reduceColumns(reducer=ee.Reducer.median(), selectors=[key])
            ).get("median")
        ),
        ee.Number(_PCT_CSV_SENTINEL),
    )


def median_of_monthly_spatial_percentiles_for_year(
    ic: ee.ImageCollection,
    *,
    year: ee.Number,
    source_band: str,
    geometry: ee.Geometry,
    scale: float,
    image_prep: Callable[[ee.Image], ee.Image],
    out_band: str,
    max_pixels: float = 1e13,
    tile_scale: int = 2,
) -> tuple[ee.Number, ee.Number]:
    """
    Colección año–mes: por mes, P25/P75 espaciales sobre ``geometry`` en la banda
    preparada ``out_band``; luego mediana de P25 y mediana de P75 entre meses
    con datos (AOD, NO2, SO2 regional).
    """
    k25 = f"{out_band}_p25"
    k75 = f"{out_band}_p75"
    empty = ee.Dictionary({k25: None, k75: None})

    def month_feat(mo: Any) -> ee.Feature:
        mo_n = ee.Number(mo)
        sub = ic.filter(
            ee.Filter.And(ee.Filter.eq("year", year), ee.Filter.eq("month", mo_n))
        )
        has = sub.size().gt(0)
        stat_dict = ee.Algorithms.If(
            has,
            ee.Dictionary(
                image_prep(ee.Image(sub.first()).select(source_band)).reduceRegion(
                    reducer=ee.Reducer.percentile([25, 75]),
                    geometry=geometry,
                    scale=scale,
                    maxPixels=max_pixels,
                    tileScale=tile_scale,
                    bestEffort=True,
                )
            ),
            empty,
        )
        d = ee.Dictionary(stat_dict)
        return ee.Feature(None, {"p25": d.get(k25), "p75": d.get(k75)})

    mfc = ee.FeatureCollection(ee.List.sequence(1, 12).map(month_feat)).filter(
        ee.Filter.notNull(["p25", "p75"])
    )
    return _median_of_numeric_features(mfc, "p25"), _median_of_numeric_features(
        mfc, "p75"
    )


def lst_fc_month_composite_p25p75_row(
    landsat: ee.ImageCollection,
    *,
    year: ee.Number,
    month: ee.Number,
    urban_fc: ee.FeatureCollection,
    scale: float,
) -> ee.Feature:
    subset = landsat.filter(ee.Filter.calendarRange(month, month, "month")).filter(
        ee.Filter.calendarRange(year, year, "year")
    )
    has_data = subset.size().gt(0)
    composite = subset.select("LST_mean").median().clip(urban_fc.geometry())
    stats = composite.reduceRegions(
        collection=urban_fc,
        reducer=ee.Reducer.percentile([25, 75]),
        scale=scale,
    )
    k25 = "LST_mean_p25"
    k75 = "LST_mean_p75"
    n = stats.size()
    p25m = ee.Algorithms.If(
        has_data,
        ee.Algorithms.If(n.gt(0), stats.aggregate_mean(k25), None),
        None,
    )
    p75m = ee.Algorithms.If(
        has_data,
        ee.Algorithms.If(n.gt(0), stats.aggregate_mean(k75), None),
        None,
    )
    return ee.Feature(None, {"p25": p25m, "p75": p75m})


def lst_median_of_monthly_fc_p25p75(
    landsat: ee.ImageCollection,
    *,
    year: ee.Number,
    urban_fc: ee.FeatureCollection,
    scale: float,
) -> tuple[ee.Number, ee.Number]:
    """Misma lógica intra-anual que NDVI, sobre compuestos Landsat mensuales urbanos."""

    def one(mo: Any) -> ee.Feature:
        return lst_fc_month_composite_p25p75_row(
            landsat, year=year, month=ee.Number(mo), urban_fc=urban_fc, scale=scale
        )

    mfc = ee.FeatureCollection(ee.List.sequence(1, 12).map(one)).filter(
        ee.Filter.notNull(["p25", "p75"])
    )
    return _median_of_numeric_features(mfc, "p25"), _median_of_numeric_features(
        mfc, "p75"
    )
