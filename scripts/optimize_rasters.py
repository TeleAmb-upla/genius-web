"""
Convert Float32/Float64 GeoTIFFs to Cloud-Optimized GeoTIFFs (COG) with
Int16 quantization for web visualization.

Requires: GDAL (gdal_translate) installed and available on PATH.

Usage:
    python scripts/optimize_rasters.py [--dry-run]

Each variable uses a specific scale factor so the Int16 values can be
converted back on the JS side: real_value = pixel_value / SCALE_FACTOR.
"""

import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
RASTER_ROOT = REPO / "assets" / "data" / "raster"

CONFIGS = [
    {
        "label": "NDVI Yearly",
        "glob": "NDVI/NDVI_Yearly/NDVI_Yearly_*.tif",
        "scale": 10000,
        "dtype": "Int16",
        "nodata": -32768,
    },
    {
        "label": "NDVI Monthly",
        "glob": "NDVI/NDVI_Monthly/NDVI_Monthly_*.tif",
        "scale": 10000,
        "dtype": "Int16",
        "nodata": -32768,
    },
    {
        "label": "NDVI Trend",
        "glob": "NDVI/NDVI_Trend/NDVI_Yearly_Trend.tif",
        "scale": 100000,
        "dtype": "Int16",
        "nodata": -32768,
    },
    {
        "label": "LST Yearly",
        "glob": "LST/LST_Yearly/LST_Yearly_*.tif",
        "scale": 100,
        "dtype": "Int16",
        "nodata": -32768,
    },
    {
        "label": "LST Monthly",
        "glob": "LST/LST_Monthly/LST_Monthly_*.tif",
        "scale": 100,
        "dtype": "Int16",
        "nodata": -32768,
    },
    {
        "label": "LST Trend",
        "glob": "LST/LST_Trend/LST_Yearly_Trend.tif",
        "scale": 10000,
        "dtype": "Int16",
        "nodata": -32768,
    },
    {
        "label": "AOD Monthly",
        "glob": "AOD/AOD_Monthly/AOD_Monthly_*.tif",
        "scale": 100,
        "dtype": "Int16",
        "nodata": -32768,
    },
    {
        "label": "NO2 Monthly",
        "glob": "NO2/NO2_Monthly/NO2_Monthly_*.tif",
        "scale": 1000,
        "dtype": "Int16",
        "nodata": -32768,
    },
    {
        "label": "SO2 Monthly",
        "glob": "SO2/SO2_Monthly/SO2_Monthly_*.tif",
        "scale": 100,
        "dtype": "Int16",
        "nodata": -32768,
    },
]


def optimize_tif(src: Path, scale: int, dtype: str, nodata: int, dry_run: bool):
    dst = src.with_suffix(".cog.tif")
    cmd = [
        "gdal_translate",
        "-of", "COG",
        "-co", "COMPRESS=DEFLATE",
        "-co", "PREDICTOR=2",
        "-co", "OVERVIEW_RESAMPLING=AVERAGE",
        "-ot", dtype,
        "-scale", "0", str(1 / scale), "0", "1",
        "-a_nodata", str(nodata),
        str(src),
        str(dst),
    ]
    if dry_run:
        print(f"  [dry-run] {' '.join(cmd)}")
        return
    print(f"  {src.name} -> {dst.name}")
    subprocess.run(cmd, check=True)
    orig_size = src.stat().st_size
    new_size = dst.stat().st_size
    pct = (1 - new_size / orig_size) * 100 if orig_size > 0 else 0
    print(f"    {orig_size:,} -> {new_size:,} bytes ({pct:.0f}% reduction)")


def main():
    dry_run = "--dry-run" in sys.argv
    for cfg in CONFIGS:
        files = sorted(RASTER_ROOT.glob(cfg["glob"]))
        if not files:
            print(f"[{cfg['label']}] No files found for {cfg['glob']}")
            continue
        print(f"\n[{cfg['label']}] {len(files)} file(s), scale={cfg['scale']}")
        for f in files:
            if f.stat().st_size == 0:
                print(f"  SKIP (0 bytes): {f.name}")
                continue
            optimize_tif(f, cfg["scale"], cfg["dtype"], cfg["nodata"], dry_run)


if __name__ == "__main__":
    main()
