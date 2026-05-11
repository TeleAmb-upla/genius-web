"""
Enteros escalados para GeoTIFF web (mapas píxel): menor tamaño y descarga más rápida.

Debe coincidir con `scripts/repo/rasters/quantize_rasters_web.py` y `assets/js/raster_quantized_decode.js`.
Aplicar solo a imágenes exportadas a **Drive** para el repo (no a assets intermedios
con otras bandas).
"""
from __future__ import annotations

import ee


def int16_scaled_band(image: ee.Image, band: str, scale: float) -> ee.Image:
    """Valor_físico ≈ pixel_int16 / scale (nodata -32768 en post-proceso local)."""
    return (
        image.select(band).multiply(scale).round().toInt16().rename(band)
    )


def int16_rounded_band(image: ee.Image, band: str) -> ee.Image:
    """Unidades físicas ≈ entero (p. ej. SO2 en repo)."""
    return image.select(band).round().toInt16().rename(band)
