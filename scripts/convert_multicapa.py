"""
Optimize Multicapa drone TIF files for web display.

Converts large drone TIFs to Cloud-Optimized GeoTIFF (COG) for efficient
streaming via GeoRasterLayer, or to WEBP with bounds if too large.

Run:
    python -m scripts.convert_multicapa

Files expected in assets/data/raster/Multicapa/:
  - PlazaVieja_Dia_RGB.tif
  - PlazaVieja_Dia_Termico.tif
  - PlazaVieja_Noche_Class.geojson
"""
from __future__ import annotations

import json
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
MULTICAPA_DIR = PROJECT_ROOT / "assets" / "data" / "raster" / "Multicapa"

MAX_SIZE_MB = 30
TARGET_MAX_DIM = 4096


def _optimize_tif(tif_path: Path) -> None:
    """If the TIF is too large, downsample and convert to COG or WEBP."""
    if not tif_path.is_file():
        print(f"  [SKIP] No encontrado: {tif_path.name}")
        return

    size_mb = tif_path.stat().st_size / (1024 * 1024)
    print(f"  {tif_path.name}: {size_mb:.1f} MB")

    if size_mb <= MAX_SIZE_MB:
        print(f"  OK: tamaño aceptable para carga client-side con GeoRasterLayer.")
        return

    print(f"  Archivo demasiado grande ({size_mb:.0f} MB > {MAX_SIZE_MB} MB).")
    print(f"  Convirtiendo a WEBP con L.imageOverlay …")

    try:
        import rasterio
        from rasterio.enums import Resampling
        import numpy as np
        from PIL import Image
    except ImportError as e:
        print(f"  [ERROR] Dependencia faltante: {e}")
        return

    with rasterio.open(tif_path) as src:
        bounds = src.bounds
        h, w = src.height, src.width
        factor = max(h, w) / TARGET_MAX_DIM
        if factor > 1:
            new_h = int(h / factor)
            new_w = int(w / factor)
        else:
            new_h, new_w = h, w

        num_bands = min(src.count, 3)
        data = src.read(
            list(range(1, num_bands + 1)),
            out_shape=(num_bands, new_h, new_w),
            resampling=Resampling.bilinear,
        )
        if data.dtype != np.uint8:
            for i in range(num_bands):
                band = data[i].astype(np.float64)
                p2, p98 = np.percentile(band[band > 0], [2, 98]) if np.any(band > 0) else (0, 1)
                if p98 <= p2:
                    p98 = p2 + 1
                band = np.clip((band - p2) / (p98 - p2) * 255, 0, 255)
                data[i] = band.astype(np.uint8)

    webp_path = tif_path.with_suffix(".webp")
    if num_bands == 1:
        img = Image.fromarray(data[0], mode="L")
    else:
        rgb = np.stack([data[i] for i in range(num_bands)], axis=-1)
        img = Image.fromarray(rgb, mode="RGB")

    img.save(str(webp_path), "WEBP", quality=85)
    out_size = webp_path.stat().st_size / (1024 * 1024)
    print(f"  Guardado: {webp_path.name} ({out_size:.1f} MB)")

    bounds_path = tif_path.with_name(tif_path.stem + "_bounds.json")
    leaflet_bounds = [[bounds.bottom, bounds.left], [bounds.top, bounds.right]]
    bounds_path.write_text(json.dumps({"bounds": leaflet_bounds}, indent=2), encoding="utf-8")
    print(f"  Bounds: {bounds_path.name}")


def main() -> None:
    print("=" * 60)
    print("  Optimización de archivos Multicapa")
    print("=" * 60)

    MULTICAPA_DIR.mkdir(parents=True, exist_ok=True)

    for name in ("PlazaVieja_Dia_RGB.tif", "PlazaVieja_Dia_Termico.tif"):
        _optimize_tif(MULTICAPA_DIR / name)

    geojson = MULTICAPA_DIR / "PlazaVieja_Noche_Class.geojson"
    if geojson.is_file():
        size_mb = geojson.stat().st_size / (1024 * 1024)
        print(f"\n  {geojson.name}: {size_mb:.1f} MB (GeoJSON vectorial, OK para Leaflet)")
    else:
        print(f"\n  [SKIP] {geojson.name} no encontrado")

    print("\nListo.")


if __name__ == "__main__":
    main()
