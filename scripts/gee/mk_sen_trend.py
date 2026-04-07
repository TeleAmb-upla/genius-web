"""
Mann–Kendall + pendiente de Sen (espacial).

- GeoJSON: scripts/NDVI_geojson.txt (`NDVI_t_geojson`) → `mk_sen_slope_and_p_value`.
- Raster: scripts/NDVI_raster.txt (`NDVI_t_raster`) → `mk_sen_raster_trend_image`.
"""
from __future__ import annotations

import time

import ee


def _ndvi_by_year(s2_ym: ee.ImageCollection) -> ee.ImageCollection:
    first_year = ee.Number(s2_ym.sort("year").first().get("year")).add(1)
    last_year = ee.Date(int(time.time() * 1000)).get("year").subtract(1)
    years = ee.List.sequence(first_year, last_year)

    def one_year(y):
        y = ee.Number(y)
        selected = s2_ym.select("NDVI_median").filter(ee.Filter.eq("year", y))
        ndvi_median = selected.median().rename("NDVI_median")
        first_img = selected.sort("system:time_start", True).first()
        return ee.Image([ndvi_median]).set("year", y).set(
            "system:time_start", first_img.get("system:time_start")
        )

    return ee.ImageCollection.fromImages(years.map(one_year))


def _group_size_func(array: ee.Image) -> ee.Image:
    length = array.arrayLength(0)
    indices = (
        ee.Image([1])
        .arrayRepeat(0, length)
        .arrayAccum(0, ee.Reducer.sum())
        .toArray(1)
    )
    sorted_arr = array.arraySort()
    left = sorted_arr.arraySlice(0, 1)
    right = sorted_arr.arraySlice(0, 0, -1)
    mask = left.neq(right).arrayCat(ee.Image(ee.Array([[1]])), 0)
    run_indices = indices.arrayMask(mask)
    return run_indices.arraySlice(0, 1).subtract(run_indices.arraySlice(0, 0, -1))


def mk_sen_slope_and_p_value(s2_ym: ee.ImageCollection) -> tuple[ee.Image, ee.Image]:
    """
    Replica exports.NDVI_t_geojson (apartado tendencia) del JS.
    Retorna (sens_slope, p_value) con bandas listas para reduceRegions.
    """
    ndviby_year = _ndvi_by_year(s2_ym)
    ndvi_only = ndviby_year.select("NDVI_median")

    joined_fc = ee.Join.saveAll("after").apply(
        primary=ndvi_only,
        secondary=ndvi_only,
        condition=ee.Filter.lessThan(leftField="year", rightField="year"),
    )
    joined_ic = ee.ImageCollection(joined_fc)

    def pairwise_slopes(current):
        current = ee.Image(current)
        after_coll = ee.ImageCollection.fromImages(current.get("after"))
        return after_coll.map(
            lambda image: ee.Image(image)
            .subtract(current)
            .divide(
                ee.Image(image).date().get("year").subtract(current.date().get("year"))
            )
            .rename("slope")
            .float()
        )

    slopes_nested = joined_ic.map(pairwise_slopes)
    slopes = ee.ImageCollection(slopes_nested.flatten())
    sens_slope = slopes.reduce(ee.Reducer.median(), 2).rename("slope_median")

    def pairwise_signs(current):
        current = ee.Image(current)
        after_coll = ee.ImageCollection.fromImages(current.get("after"))
        return after_coll.map(
            lambda image: ee.Image(image)
            .neq(current)
            .multiply(ee.Image(image).subtract(current).clamp(-1, 1))
            .unmask(0)
        )

    kendall_nested = joined_ic.map(pairwise_signs)
    kendall = ee.ImageCollection(kendall_nested.flatten()).reduce(ee.Reducer.sum(), 2)

    def group_for_i(i):
        i = ee.Image(i)
        matches = ndvi_only.map(lambda j: ee.Image(j).eq(i)).sum()
        return i.multiply(matches.gt(1))

    groups = ndvi_only.map(group_for_i)
    group_sizes = _group_size_func(groups.toArray())
    group_factors = group_sizes.expression("b() * (b() - 1) * (b() * 2 + 5)")
    group_factor_sum = group_factors.arrayReduce(ee.Reducer.sum(), [0]).arrayGet([0, 0])

    count = joined_ic.count()
    kendall_variance = (
        count.expression("b() * (b() - 1) * (b() * 2 + 5)")
        .subtract(group_factor_sum)
        .divide(18)
        .float()
    )

    zero = kendall.multiply(kendall.eq(0))
    pos = kendall.multiply(kendall.gt(0)).subtract(1)
    neg = kendall.multiply(kendall.lt(0)).add(1)
    z = zero.add(pos.divide(kendall_variance.sqrt())).add(
        neg.divide(kendall_variance.sqrt())
    )
    p_value = ee.Image(1).subtract(
        ee.Image(0.5).multiply(
            ee.Image(1).add(z.abs().divide(ee.Image(2).sqrt()).erf())
        )
    ).rename("p_value")

    return sens_slope, p_value


def _group_size_func_raster(array: ee.Image) -> ee.Image:
    """Igual que `groupFunc` en scripts/NDVI_raster.txt (`NDVI_t_raster`)."""
    length = array.arrayLength(0)
    indices = (
        ee.Image([1])
        .arrayRepeat(0, length)
        .arrayAccum(0, ee.Reducer.sum())
        .toArray(1)
    )
    sorted_arr = array.arraySort()
    mask = (
        sorted_arr.arraySlice(0, 1)
        .neq(sorted_arr.arraySlice(0, 0, -1))
        .arrayCat(ee.Image(ee.Array([[1]])), 0)
    )
    run_indices = indices.arrayMask(mask)
    return run_indices.arraySlice(0, 1).subtract(run_indices.arraySlice(0, 0, -1))


def mk_sen_raster_trend_image(
    s2_ym: ee.ImageCollection,
    gran_valparaiso: ee.FeatureCollection,
    area_urbana: ee.Feature,
) -> ee.Image:
    """
    Réplica de `exports.NDVI_t_raster` en NDVI_raster.txt (MK + Sen → banda `trend`).
    kendall, varS y z siguen el JS; se enlazan con `trend + 0*k + 0*v + 0*z` para que el
    valor exportado sea la mediana de pendientes Sen sin cambiar el grafo de dependencias.
    """
    gran_geom = gran_valparaiso.geometry()
    urban_geom = area_urbana.geometry()

    first_year = ee.Number(s2_ym.sort("year").first().get("year")).add(1)
    last_year = ee.Date(int(time.time() * 1000)).get("year").subtract(1)
    years = ee.List.sequence(first_year, last_year)

    def one_year_raster(y):
        y = ee.Number(y)
        selected = s2_ym.select("NDVI_median").filter(
            ee.Filter.calendarRange(y, y, "year")
        )
        return (
            selected.median()
            .rename("NDVI_median")
            .set("year", y)
            .set("system:time_start", ee.Date.fromYMD(y, 1, 1).millis())
            .clip(gran_geom)
        )

    ndviby_year = ee.ImageCollection.fromImages(years.map(one_year_raster))
    ndvi_only = ndviby_year.select("NDVI_median")

    joined_fc = ee.Join.saveAll("after").apply(
        primary=ndvi_only,
        secondary=ndvi_only,
        condition=ee.Filter.lessThan(leftField="year", rightField="year"),
    )
    joined_ic = ee.ImageCollection(joined_fc)

    def pairwise_signs(current):
        current = ee.Image(current)
        after_coll = ee.ImageCollection.fromImages(current.get("after"))
        return after_coll.map(
            lambda img: ee.Image(img)
            .neq(current)
            .multiply(ee.Image(img).subtract(current).clamp(-1, 1))
            .unmask(0)
        )

    kendall_nested = joined_ic.map(pairwise_signs)
    kendall = (
        ee.ImageCollection(kendall_nested.flatten())
        .reduce(ee.Reducer.sum(), 2)
        .clip(urban_geom)
    )

    def pairwise_slopes_raster(current):
        current = ee.Image(current)
        after_coll = ee.ImageCollection.fromImages(current.get("after"))
        return after_coll.map(
            lambda img: ee.Image(img)
            .subtract(current)
            .divide(ee.Image(img).date().difference(current.date(), "years"))
            .rename("slope")
            .float()
        )

    slopes_nested = joined_ic.map(pairwise_slopes_raster)
    slopes = ee.ImageCollection(slopes_nested.flatten())
    sens_slope = slopes.reduce(ee.Reducer.median(), 2)

    def group_for_i(i):
        i = ee.Image(i)
        matches = ndvi_only.map(lambda j: ee.Image(j).eq(i)).sum()
        return i.multiply(matches.gt(1))

    groups = ndvi_only.map(group_for_i)
    group_factors = _group_size_func_raster(groups.toArray()).expression(
        "b() * (b() - 1) * (b() * 2 + 5)"
    )
    group_factor_sum = group_factors.arrayReduce(ee.Reducer.sum(), [0]).arrayGet([0, 0])
    var_s = (
        joined_ic.count()
        .expression("b() * (b() - 1) * (b() * 2 + 5)")
        .subtract(group_factor_sum)
        .divide(18)
        .float()
    )
    z = kendall.expression(
        "b() > 0 ? (b()-1)/sqrt(v) : (b()<0 ? (b()+1)/sqrt(v) : 0)",
        {"v": var_s},
    )

    trend_core = sens_slope.select(["slope_median"], ["trend"]).clip(urban_geom)
    return trend_core.expression(
        "trend + 0 * k + 0 * v + 0 * z",
        {"trend": trend_core, "k": kendall, "v": var_s, "z": z},
    )
