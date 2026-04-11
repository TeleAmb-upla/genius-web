"""Regenera WebP de clasificación Iluminación: clase 1 = nodata (transparente); 2–4 = Baja/Media/Alta."""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from rasterio.warp import transform_bounds


def main() -> int:
    repo = Path(__file__).resolve().parents[2]
    base = repo / "assets" / "data" / "raster" / "Iluminacion"
    src_tif = base / "ILU_CLASS_RESAMPLE_1m.tif"
    out_webp = base / "ILU_CLASS_RESAMPLE_1m.webp"
    bounds_json = base / "illumination_class_bounds.json"

    with rasterio.open(src_tif) as ds:
        data = ds.read(1).astype(np.int32)
        src_crs = ds.crs
        h, w = data.shape

        rgba = np.zeros((h, w, 4), dtype=np.uint8)
        # 1 = fuera de ámbito / nodata → transparente
        m2 = data == 2
        m3 = data == 3
        m4 = data == 4
        rgba[m2] = [0, 0, 128, 200]  # Baja
        rgba[m3] = [255, 0, 0, 200]  # Media
        rgba[m4] = [255, 255, 0, 200]  # Alta

        # Recortar a píxeles con datos válidos (2–4)
        valid = m2 | m3 | m4
        rows = np.any(valid, axis=1)
        cols = np.any(valid, axis=0)
        if rows.any() and cols.any():
            r0, r1 = np.where(rows)[0][[0, -1]]
            c0, c1 = np.where(cols)[0][[0, -1]]
            data = data[r0 : r1 + 1, c0 : c1 + 1]
            rgba = rgba[r0 : r1 + 1, c0 : c1 + 1]
            transform = ds.transform
            left = transform.c + c0 * transform.a
            top = transform.f + r0 * transform.e
            right = transform.c + (c1 + 1) * transform.a
            bottom = transform.f + (r1 + 1) * transform.e
        else:
            left, bottom, right, top = ds.bounds

        img = Image.fromarray(rgba, "RGBA")
        img.save(out_webp, "WEBP", quality=65, lossless=False)
        print(f"Wrote {out_webp} ({out_webp.stat().st_size / 1e6:.2f} MB)")

        wgs84 = transform_bounds(src_crs, "EPSG:4326", left, bottom, right, top)
        bounds_payload = {
            "bounds": [[wgs84[1], wgs84[0]], [wgs84[3], wgs84[2]]],
        }
        bounds_json.write_text(json.dumps(bounds_payload, indent=2), encoding="utf-8")
        print(f"Wrote {bounds_json}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
