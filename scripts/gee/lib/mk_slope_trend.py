"""
Núcleo Mann–Kendall + pendiente de Sen (espacial) sobre una colección anual de una sola banda.

Estructura lineal tipo Earth Engine Code Editor: utilidades arriba y el flujo completo
de la prueba + pendiente debajo, sin depender de agregación año-mes (eso vive en ``mk_sen``).
"""
from __future__ import annotations

import ee


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
