"""
Mann–Kendall + pendiente de Sen (espacial), genérico por nombre de banda.

Usado por NDVI, AOD, NO2, SO2, LST (colecciones año-mes con propiedad ``year``).
"""
from __future__ import annotations

import ee

from . import yearmonth as ym_lib


def images_by_year_median(
    ic: ee.ImageCollection,
    band_name: str,
    last_calendar_year: int,
    *,
    first_year_offset: int = 1,
) -> ee.ImageCollection:
    """Una imagen por año: mediana mensual de ``band_name`` dentro de ese año.

    Pre-filters ``ic`` to images that actually carry ``band_name`` so that
    every year in the output is guaranteed to have the band (no bandless
    phantom images).  Years are matched on the ``year`` metadata property
    – not on ``system:time_start`` calendar year – to avoid mismatches.
    """
    safe_ic = ic.filter(
        ee.Filter.listContains("system:band_names", band_name)
    )
    band_ic = safe_ic.select(band_name)

    first_year = ee.Number(safe_ic.sort("year").first().get("year")).add(first_year_offset)
    last_year = ee.Number(last_calendar_year)
    available_years = (
        ee.List(safe_ic.aggregate_array("year"))
        .map(lambda y: ee.Number(y).toInt())
        .distinct()
        .sort()
    )
    target_years = available_years.filter(
        ee.Filter.And(
            ee.Filter.gte("item", first_year),
            ee.Filter.lte("item", last_year),
        )
    )

    def one_year(y):
        y = ee.Number(y)
        selected = band_ic.filter(ee.Filter.eq("year", y))
        med = selected.median().rename(band_name)
        millis = ee.Date.fromYMD(y, 1, 1).millis()
        return med.set("year", y).set("system:time_start", millis)

    return ee.ImageCollection.fromImages(target_years.map(one_year))


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


def _mk_sen_slope_p_from_band_only(band_only: ee.ImageCollection) -> tuple[ee.Image, ee.Image]:
    """Mann–Kendall + Sen sobre una colección ya anual (una imagen por año, una banda)."""
    joined_fc = ee.Join.saveAll("after").apply(
        primary=band_only,
        secondary=band_only,
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
        matches = band_only.map(lambda j: ee.Image(j).eq(i)).sum()
        return i.multiply(matches.gt(1))

    groups = band_only.map(group_for_i)
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


def mk_sen_slope_and_p_value_annual(
    annual_ic: ee.ImageCollection,
    band_name: str,
) -> tuple[ee.Image, ee.Image]:
    """Misma lógica zonal que ``mk_sen_slope_and_p_value`` pero entrada ya anual."""
    band_only = annual_ic.filter(
        ee.Filter.listContains("system:band_names", band_name)
    ).select(band_name)

    sens, pval = _mk_sen_slope_p_from_band_only(band_only)

    n = band_only.size()
    empty_slope = ee.Image.constant(0).rename("slope_median").updateMask(ee.Image(0))
    empty_pval = ee.Image.constant(1).rename("p_value").updateMask(ee.Image(0))
    return (
        ee.Image(ee.Algorithms.If(n.gte(3), sens, empty_slope)),
        ee.Image(ee.Algorithms.If(n.gte(3), pval, empty_pval)),
    )


def mk_sen_slope_and_p_value(
    ic: ee.ImageCollection,
    *,
    band_name: str,
    last_calendar_year: int | None = None,
    first_year_offset: int = 1,
) -> tuple[ee.Image, ee.Image]:
    """
    Tendencia zonal: (sens_slope, p_value).
    Si ``last_calendar_year`` es None, se usa ``effective_yearly_export_year`` (reloj + cobertura asset).
    """
    if last_calendar_year is None:
        last_calendar_year = ym_lib.effective_yearly_export_year(ic)

    by_year = images_by_year_median(
        ic, band_name, last_calendar_year, first_year_offset=first_year_offset
    )
    band_only = by_year.select(band_name)

    sens, pval = _mk_sen_slope_p_from_band_only(band_only)

    n = band_only.size()
    empty_slope = ee.Image.constant(0).rename("slope_median").updateMask(ee.Image(0))
    empty_pval = ee.Image.constant(1).rename("p_value").updateMask(ee.Image(0))
    return (
        ee.Image(ee.Algorithms.If(n.gte(3), sens, empty_slope)),
        ee.Image(ee.Algorithms.If(n.gte(3), pval, empty_pval)),
    )


def _group_size_func_raster(array: ee.Image) -> ee.Image:
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
    ic: ee.ImageCollection,
    gran_valparaiso: ee.FeatureCollection,
    area_urbana: ee.Feature,
    *,
    band_name: str,
    last_calendar_year: int | None = None,
    first_year_offset: int = 1,
) -> ee.Image:
    """
    Raster de tendencia (banda ``trend``): mediana Sen con dependencias MK (como NDVI JS).
    """
    gran_geom = gran_valparaiso.geometry()
    urban_geom = area_urbana.geometry()

    if last_calendar_year is None:
        last_calendar_year = ym_lib.effective_yearly_export_year(ic)

    safe_ic = ic.filter(
        ee.Filter.listContains("system:band_names", band_name)
    )
    band_ic = safe_ic.select(band_name)

    first_year = ee.Number(safe_ic.sort("year").first().get("year")).add(first_year_offset)
    last_year = ee.Number(last_calendar_year)
    available_years = (
        ee.List(safe_ic.aggregate_array("year"))
        .map(lambda y: ee.Number(y).toInt())
        .distinct()
        .sort()
        .filter(
            ee.Filter.And(
                ee.Filter.gte("item", first_year),
                ee.Filter.lte("item", last_year),
            )
        )
    )

    def one_year_raster(y):
        y = ee.Number(y)
        selected = band_ic.filter(ee.Filter.eq("year", y))
        millis = ee.Date.fromYMD(y, 1, 1).millis()
        return (
            selected.median()
            .rename(band_name)
            .set("year", y)
            .set("system:time_start", millis)
            .clip(gran_geom)
        )

    by_year = ee.ImageCollection.fromImages(available_years.map(one_year_raster))
    band_only = by_year.select(band_name)

    joined_fc = ee.Join.saveAll("after").apply(
        primary=band_only,
        secondary=band_only,
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
        matches = band_only.map(lambda j: ee.Image(j).eq(i)).sum()
        return i.multiply(matches.gt(1))

    groups = band_only.map(group_for_i)
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
    trend_result = trend_core.expression(
        "trend + 0 * k + 0 * v + 0 * z",
        {"trend": trend_core, "k": kendall, "v": var_s, "z": z},
    )

    n = band_only.size()
    empty_trend = (
        ee.Image.constant(0).rename("trend").updateMask(ee.Image(0)).clip(urban_geom)
    )
    return ee.Image(ee.Algorithms.If(n.gte(3), trend_result, empty_trend))


def mk_sen_raster_trend_masked_p(
    ic: ee.ImageCollection,
    region_geom: ee.Geometry,
    *,
    band_name: str,
    last_calendar_year: int | None = None,
    first_year_offset: int = 1,
    p_max: float = 0.025,
) -> ee.Image:
    """
    Tendencia raster con máscara p<=``p_max`` (AOD / NO2 / SO2 en scripts JS).
    Entrada: colección año-mes; se agrega a anual por mediana de ``band_name``.
    """
    if last_calendar_year is None:
        last_calendar_year = ym_lib.effective_yearly_export_year(ic)
    by_year = images_by_year_median(
        ic, band_name, last_calendar_year, first_year_offset=first_year_offset
    )
    band_only = by_year.select(band_name).map(
        lambda img: ee.Image(img).clip(region_geom)
    )

    sens, pval = _mk_sen_slope_p_from_band_only(band_only)
    result = (
        sens.updateMask(pval.lte(p_max))
        .select(["slope_median"], ["trend"])
        .clip(region_geom)
    )

    n = band_only.size()
    empty_trend = (
        ee.Image.constant(0).rename("trend").updateMask(ee.Image(0)).clip(region_geom)
    )
    return ee.Image(ee.Algorithms.If(n.gte(3), result, empty_trend))


def mk_sen_raster_trend_masked_p_annual(
    annual_ic: ee.ImageCollection,
    region_geom: ee.Geometry,
    band_name: str,
    *,
    p_max: float = 0.025,
) -> ee.Image:
    """Igual que ``mk_sen_raster_trend_masked_p`` pero la colección ya es anual."""
    band_only = annual_ic.filter(
        ee.Filter.listContains("system:band_names", band_name)
    ).select(band_name).map(lambda img: ee.Image(img).clip(region_geom))

    sens, pval = _mk_sen_slope_p_from_band_only(band_only)
    result = (
        sens.updateMask(pval.lte(p_max))
        .select(["slope_median"], ["trend"])
        .clip(region_geom)
    )

    n = band_only.size()
    empty_trend = (
        ee.Image.constant(0).rename("trend").updateMask(ee.Image(0)).clip(region_geom)
    )
    return ee.Image(ee.Algorithms.If(n.gte(3), result, empty_trend))
