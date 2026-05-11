"""
Convert heavy illumination assets to web-optimized WEBP images.

1. TIF RGB drone image (~7GB) → WEBP (<5MB) with georeferenced bounds.
2. GeoJSON classified polygons → WEBP raster with the same color scheme.

Run:
    python -m scripts.repo.rasters.convert_illumination

Requires: rasterio, Pillow, geopandas, matplotlib
"""
from __future__ import annotations

import json
import re
import sys
from pathlib import Path

import numpy as np

PROJECT_ROOT = Path(__file__).resolve().parents[3]

TIF_PATH = PROJECT_ROOT / "assets" / "data" / "raster" / "Iluminacion" / "M3T_RGB_QUI_2024_07.tif"
GEOJSON_PATH = PROJECT_ROOT / "assets" / "data" / "vectores" / "Quilpue_Class_Smoothed.geojson"

TIF_WEBP_OUT = TIF_PATH.with_suffix(".webp")
GEOJSON_WEBP_OUT = GEOJSON_PATH.with_suffix(".webp")

BOUNDS_JSON = PROJECT_ROOT / "assets" / "data" / "raster" / "Iluminacion" / "illumination_bounds.json"
GEOJSON_BOUNDS_JSON = PROJECT_ROOT / "assets" / "data" / "vectores" / "illumination_class_bounds.json"
FRONT_CATALOG_JSON = (
    PROJECT_ROOT / "assets" / "data" / "raster" / "Iluminacion" / "illumination_front_catalog.json"
)

_SPANISH_MONTHS = (
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
)

# Máx. lado en px para WebP del mapa (Leaflet). 4096: mejor nitidez; bounds del TIF → WGS84 abajo.
TARGET_MAX_DIM = 4096
WEBP_QUALITY = 82

GRIDCODE_COLORS = {
    1: (0, 0, 0, 0),        # Transparent
    2: (0, 0, 128, 255),     # Navy (Baja)
    3: (255, 0, 0, 255),     # Red (Media)
    4: (255, 255, 0, 255),   # Yellow (Alta)
}


def _map_title_from_illumination_stem(stem: str) -> str:
    m = re.search(r"_(\d{4})_(\d{2})", stem)
    if not m:
        return "Iluminación - Invierno 2024"
    y, mo = int(m.group(1)), int(m.group(2))
    if 1 <= mo <= 12:
        return f"Iluminación - {_SPANISH_MONTHS[mo - 1].title()} {y}"
    return f"Iluminación - {y}"


def _write_illumination_front_catalog() -> None:
    path = TIF_PATH if TIF_PATH.is_file() else TIF_WEBP_OUT
    if not path.is_file():
        return
    title = _map_title_from_illumination_stem(path.stem)
    FRONT_CATALOG_JSON.parent.mkdir(parents=True, exist_ok=True)
    FRONT_CATALOG_JSON.write_text(
        json.dumps({"map_title": title}, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(f"  Catálogo front iluminación: {FRONT_CATALOG_JSON.name}")


def _convert_tif_to_webp() -> dict | None:
    """Downsample TIF RGB and save as WEBP. Returns Leaflet bounds or None."""
    if not TIF_PATH.is_file():
        print(f"  [SKIP] TIF no encontrado: {TIF_PATH}")
        return None

    try:
        import rasterio
        from rasterio.enums import Resampling
        from rasterio.warp import transform_bounds
        from PIL import Image
    except ImportError as e:
        print(f"  [ERROR] Dependencia faltante: {e}")
        return None

    print(f"  Leyendo TIF: {TIF_PATH.name} …")
    with rasterio.open(TIF_PATH) as src:
        bounds = src.bounds
        src_crs = src.crs
        h, w = src.height, src.width
        factor = max(h, w) / TARGET_MAX_DIM
        if factor > 1:
            new_h = int(h / factor)
            new_w = int(w / factor)
        else:
            new_h, new_w = h, w

        print(f"  Original: {w}x{h}, reescalando a {new_w}x{new_h}")

        num_bands = min(src.count, 3)
        # Huella válida con nearest (evita que el bilineal “llene” bordes 0/nodata del ortofoto).
        rN = src.read(1, out_shape=(new_h, new_w), resampling=Resampling.nearest)
        if num_bands >= 2:
            gN = src.read(2, out_shape=(new_h, new_w), resampling=Resampling.nearest)
        else:
            gN = np.zeros_like(rN)
        if num_bands >= 3:
            bN = src.read(3, out_shape=(new_h, new_w), resampling=Resampling.nearest)
        else:
            bN = np.zeros_like(rN)
        valid = (rN > 0) | (gN > 0) | (bN > 0)

        data = src.read(
            list(range(1, num_bands + 1)),
            out_shape=(num_bands, new_h, new_w),
            resampling=Resampling.bilinear,
        )

        if data.dtype != np.uint8:
            for i in range(num_bands):
                band = data[i].astype(np.float64)
                m = valid & (band > 0)
                p2, p98 = np.percentile(band[m], [2, 98]) if np.any(m) else (0, 1)
                if p98 <= p2:
                    p98 = p2 + 1
                band = np.clip((band - p2) / (p98 - p2) * 255, 0, 255)
                data[i] = band.astype(np.uint8)

        if num_bands == 1:
            gray = data[0]
            gray[~valid] = 0
            rgba = np.dstack([gray, gray, gray, (valid.astype(np.uint8) * 255)])
            img = Image.fromarray(rgba, mode="RGBA")
        else:
            rgb = np.stack([data[i] for i in range(num_bands)], axis=-1)
            rgb[~valid] = 0
            alpha = (valid.astype(np.uint8) * 255)
            rgba = np.dstack([rgb, alpha])
            img = Image.fromarray(rgba, mode="RGBA")

    TIF_WEBP_OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(TIF_WEBP_OUT), "WEBP", quality=WEBP_QUALITY)
    size_mb = TIF_WEBP_OUT.stat().st_size / (1024 * 1024)
    print(f"  Guardado: {TIF_WEBP_OUT.name} ({size_mb:.1f} MB)")

    # Leaflet imageOverlay exige [[sur, oeste], [norte, este]] en WGS84 (no coords. proyectadas).
    wgs = transform_bounds(src_crs, "EPSG:4326", bounds.left, bounds.bottom, bounds.right, bounds.top)
    leaflet_bounds = [[wgs[1], wgs[0]], [wgs[3], wgs[2]]]
    BOUNDS_JSON.write_text(json.dumps({"bounds": leaflet_bounds}, indent=2), encoding="utf-8")
    print(f"  Bounds: {BOUNDS_JSON.name}")
    return {"bounds": leaflet_bounds}


def _convert_geojson_to_webp() -> dict | None:
    """Rasterize classified GeoJSON to a WEBP image. Returns Leaflet bounds or None."""
    if not GEOJSON_PATH.is_file():
        print(f"  [SKIP] GeoJSON no encontrado: {GEOJSON_PATH}")
        return None

    try:
        import geopandas as gpd
        from PIL import Image
        from shapely.geometry import box
    except ImportError as e:
        print(f"  [ERROR] Dependencia faltante: {e}")
        return None

    print(f"  Leyendo GeoJSON: {GEOJSON_PATH.name} …")
    gdf = gpd.read_file(GEOJSON_PATH)
    total_bounds = gdf.total_bounds
    minx, miny, maxx, maxy = total_bounds

    aspect = (maxx - minx) / (maxy - miny) if (maxy - miny) > 0 else 1
    if aspect >= 1:
        img_w = TARGET_MAX_DIM
        img_h = int(TARGET_MAX_DIM / aspect)
    else:
        img_h = TARGET_MAX_DIM
        img_w = int(TARGET_MAX_DIM * aspect)

    print(f"  Rasterizando a {img_w}x{img_h} …")

    try:
        from rasterio.features import rasterize
        from rasterio.transform import from_bounds
        import rasterio

        transform = from_bounds(minx, miny, maxx, maxy, img_w, img_h)
        shapes = []
        for _, row in gdf.iterrows():
            gc = int(row.get("gridcode", 0))
            if gc in GRIDCODE_COLORS:
                shapes.append((row.geometry, gc))

        raster = rasterize(
            shapes,
            out_shape=(img_h, img_w),
            transform=transform,
            fill=0,
            dtype=np.uint8,
        )

        rgba = np.zeros((img_h, img_w, 4), dtype=np.uint8)
        for gc, color in GRIDCODE_COLORS.items():
            mask = raster == gc
            for c in range(4):
                rgba[:, :, c][mask] = color[c]

    except ImportError:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib.collections import PatchCollection
        from matplotlib.patches import Polygon as MplPolygon

        fig, ax = plt.subplots(1, 1, figsize=(img_w / 100, img_h / 100), dpi=100)
        ax.set_xlim(minx, maxx)
        ax.set_ylim(miny, maxy)
        ax.set_aspect("equal")
        ax.axis("off")

        color_map = {
            1: (0, 0, 0, 0),
            2: (0, 0, 0.5, 1),
            3: (1, 0, 0, 1),
            4: (1, 1, 0, 1),
        }
        for gc, color in color_map.items():
            subset = gdf[gdf["gridcode"] == gc]
            if subset.empty:
                continue
            patches = []
            for geom in subset.geometry:
                if geom.geom_type == "Polygon":
                    patches.append(MplPolygon(np.array(geom.exterior.coords)))
                elif geom.geom_type == "MultiPolygon":
                    for poly in geom.geoms:
                        patches.append(MplPolygon(np.array(poly.exterior.coords)))
            if patches:
                pc = PatchCollection(patches, facecolor=color, edgecolor="none")
                ax.add_collection(pc)

        fig.savefig(str(GEOJSON_WEBP_OUT), format="webp", bbox_inches="tight", pad_inches=0, dpi=100)
        plt.close(fig)

        size_mb = GEOJSON_WEBP_OUT.stat().st_size / (1024 * 1024)
        print(f"  Guardado (matplotlib): {GEOJSON_WEBP_OUT.name} ({size_mb:.1f} MB)")
        leaflet_bounds = [[miny, minx], [maxy, maxx]]
        GEOJSON_BOUNDS_JSON.parent.mkdir(parents=True, exist_ok=True)
        GEOJSON_BOUNDS_JSON.write_text(json.dumps({"bounds": leaflet_bounds}, indent=2), encoding="utf-8")
        return {"bounds": leaflet_bounds}

    img = Image.fromarray(rgba, mode="RGBA")
    GEOJSON_WEBP_OUT.parent.mkdir(parents=True, exist_ok=True)
    img.save(str(GEOJSON_WEBP_OUT), "WEBP", quality=WEBP_QUALITY)
    size_mb = GEOJSON_WEBP_OUT.stat().st_size / (1024 * 1024)
    print(f"  Guardado: {GEOJSON_WEBP_OUT.name} ({size_mb:.1f} MB)")

    leaflet_bounds = [[miny, minx], [maxy, maxx]]
    GEOJSON_BOUNDS_JSON.parent.mkdir(parents=True, exist_ok=True)
    GEOJSON_BOUNDS_JSON.write_text(json.dumps({"bounds": leaflet_bounds}, indent=2), encoding="utf-8")
    print(f"  Bounds: {GEOJSON_BOUNDS_JSON.name}")
    return {"bounds": leaflet_bounds}


def main() -> None:
    print("═" * 60)
    print("  Conversión de archivos de Iluminación a WEBP")
    print("═" * 60)

    print("\n1. TIF RGB → WEBP")
    _convert_tif_to_webp()

    print("\n2. GeoJSON clasificado → WEBP")
    _convert_geojson_to_webp()

    print("\n3. Catálogo front (título mapa + años en JS)")
    _write_illumination_front_catalog()
    from scripts.gee.lib.genius_frontend_catalog import refresh_genius_frontend_catalog

    refresh_genius_frontend_catalog()

    print("\nListo.")


if __name__ == "__main__":
    main()
