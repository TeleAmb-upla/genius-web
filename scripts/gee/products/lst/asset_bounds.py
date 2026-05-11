"""Límite inferior de años según el asset ``LST_YearMonth`` en Earth Engine."""

from __future__ import annotations

import ee

from ...config import paths
from .constants import LST_ASSET_MIN_YEAR_FALLBACK, LST_PRODUCT_MIN_YEAR

_cached_lo: int | None = None


def clear_lst_asset_min_year_cache() -> None:
    """Útil en tests o tras repoblar el asset."""
    global _cached_lo
    _cached_lo = None


def lst_asset_min_year() -> int:
    """
    Año mínimo operativo para filtros LST en GEE: el mayor entre el mínimo real del
    asset ``LST_YearMonth`` y ``LST_PRODUCT_MIN_YEAR`` (1997).

    Llamar tras ``initialize_ee()``. Si la colección está vacía o falla la API,
    usa ``LST_ASSET_MIN_YEAR_FALLBACK``.
    """
    global _cached_lo
    if _cached_lo is not None:
        return _cached_lo
    try:
        ic = ee.ImageCollection(paths.ASSET_LST_YEARMONTH)
        if int(ic.size().getInfo()) == 0:
            raw_lo = LST_ASSET_MIN_YEAR_FALLBACK
        else:
            raw = ee.Number(ic.aggregate_min("year")).getInfo()
            raw_lo = int(raw) if raw is not None else LST_ASSET_MIN_YEAR_FALLBACK
    except Exception:
        raw_lo = LST_ASSET_MIN_YEAR_FALLBACK
    _cached_lo = max(raw_lo, LST_PRODUCT_MIN_YEAR)
    return _cached_lo
