"""Shared constants for LST exports."""

from __future__ import annotations

# Año mínimo único para todo el producto LST en repo, GEE y front (raster / GeoJSON / CSV).
LST_PRODUCT_MIN_YEAR = 1997

# Si no se puede leer ``aggregate_min(year)`` del asset (sin EE, error de red o IC vacía).
LST_ASSET_MIN_YEAR_FALLBACK = LST_PRODUCT_MIN_YEAR

# Referencia documental: Landsat 8/9 regional (sin uso obligatorio en filtros del asset año-mes).
LST_L8_L9_REGIONAL_START_YEAR = 2013

# Años excluidos de series LST derivadas (IC año–mes → anual, climatología, etc.).
# 2012: cola operativa Landsat 5 y Landsat 8 aún no aporta; en práctica casi no hay
# meses válidos sobre área urbana Quilpué (≈1/12 frente a ~11 meses típicos).
# Ajustar con ``python -m scripts.gee.tools.diagnose_lst_year_landsat`` cuando haya EE.
LST_NULL_SERIES_YEARS: frozenset[int] = frozenset({2012})
