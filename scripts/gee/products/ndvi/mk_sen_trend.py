"""
Mann–Kendall + pendiente de Sen (espacial) para NDVI.

Implementación genérica en ``scripts.gee.lib.mk_sen``; este módulo fija ``NDVI_median``.
"""
from __future__ import annotations

import ee

from ...lib import mk_sen as mk_sen_lib
from ...lib import yearmonth as ym_lib


def mk_sen_slope_and_p_value(s2_ym: ee.ImageCollection) -> tuple[ee.Image, ee.Image]:
    last_y = ym_lib.effective_yearly_export_year(s2_ym)
    return mk_sen_lib.mk_sen_slope_and_p_value(
        s2_ym,
        band_name="NDVI_median",
        last_calendar_year=last_y,
    )


def mk_sen_raster_trend_image(
    s2_ym: ee.ImageCollection,
    gran_valparaiso: ee.FeatureCollection,
    area_urbana: ee.Feature,
) -> ee.Image:
    last_y = ym_lib.effective_yearly_export_year(s2_ym)
    return mk_sen_lib.mk_sen_raster_trend_image(
        s2_ym,
        gran_valparaiso,
        area_urbana,
        band_name="NDVI_median",
        last_calendar_year=last_y,
    )
