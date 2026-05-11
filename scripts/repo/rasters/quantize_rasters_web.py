#!/usr/bin/env python3
"""
Cuantiza GeoTIFF float del front (mapas píxel) a enteros + COG DEFLATE para menor
tamaño y descarga más rápida, sin cambiar rutas .tif en el HTML/JS.

Requisitos: GDAL Python (osgeo.gdal), NumPy.

Uso:
  python3 scripts/repo/rasters/quantize_rasters_web.py [--dry-run] [--only LABEL]

Backups opcionales del original (Float32/Float64) como *.floatbak.tif al lado
del archivo (una vez por archivo, no sobrescribe un .floatbak existente).
"""
from __future__ import annotations

import argparse
import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from osgeo import gdal

REPO = Path(__file__).resolve().parents[3]
RASTER_ROOT = REPO / "assets" / "data" / "raster"

INT16_NODATA = np.int16(-32768)


@dataclass(frozen=True)
class QuantSpec:
    label: str
    glob: str
    kind: str
    """ndvi | ndvi_trend | ndvi_std | lst | lst_trend | aod | aod_trend | no2 | no2_trend | so2_round | hu_byte"""


def _specs() -> list[QuantSpec]:
    return [
        QuantSpec("NDVI Yearly", "NDVI/NDVI_Yearly/NDVI_Yearly_*.tif", "ndvi"),
        QuantSpec("NDVI Monthly", "NDVI/NDVI_Monthly/NDVI_Monthly_*.tif", "ndvi"),
        QuantSpec("NDVI Trend", "NDVI/NDVI_Trend/NDVI_Yearly_Trend.tif", "ndvi_trend"),
        QuantSpec("NDVI StdDev", "NDVI/NDVI_SD/*.tif", "ndvi_std"),
        QuantSpec("LST Yearly", "LST/LST_Yearly/LST_Yearly_*.tif", "lst"),
        QuantSpec("LST Monthly", "LST/LST_Monthly/LST_Monthly_*.tif", "lst"),
        QuantSpec("LST Trend", "LST/LST_Trend/LST_Yearly_Trend.tif", "lst_trend"),
        QuantSpec("AOD Yearly", "AOD/AOD_Yearly/AOD_Yearly_*.tif", "aod"),
        QuantSpec("AOD Monthly", "AOD/AOD_Monthly/AOD_Monthly_*.tif", "aod"),
        QuantSpec("AOD Trend", "AOD/AOD_Trend/*.tif", "aod_trend"),
        QuantSpec("NO2 Yearly", "NO2/NO2_Yearly/NO2_Yearly_*.tif", "no2"),
        QuantSpec("NO2 Monthly", "NO2/NO2_Monthly/NO2_Monthly_*.tif", "no2"),
        QuantSpec("NO2 Trend", "NO2/NO2_Trend/NO2_Yearly_Trend.tif", "no2_trend"),
        QuantSpec("SO2 Yearly", "SO2/SO2_Yearly/SO2_Yearly_*.tif", "so2_round"),
        QuantSpec("SO2 Monthly", "SO2/SO2_Monthly/SO2_Monthly_*.tif", "so2_round"),
        QuantSpec("SO2 Trend", "SO2/SO2_Trend/SO2_Yearly_Trend.tif", "so2_round"),
        QuantSpec("Huella Urbana", "Huella_Urbana/Huella_Urbana_Yearly_*.tif", "hu_byte"),
    ]


def _quantize_array(arr: np.ndarray, kind: str) -> tuple[np.ndarray, int]:
    """Retorna (array entero, gdal_type)."""
    a = np.asarray(arr, dtype=np.float64)
    mask = ~np.isfinite(a)
    a = np.where(mask, 0.0, a)

    if kind == "ndvi":
        out = np.rint(np.clip(a * 10000.0, -32767, 32767)).astype(np.int16)
    elif kind == "ndvi_trend":
        out = np.rint(np.clip(a * 100000.0, -32767, 32767)).astype(np.int16)
    elif kind == "ndvi_std":
        out = np.rint(np.clip(a * 100000.0, 0, 32767)).astype(np.int16)
    elif kind == "lst":
        out = np.rint(np.clip(a * 100.0, -32767, 32767)).astype(np.int16)
    elif kind == "lst_trend":
        out = np.rint(np.clip(a * 10000.0, -32767, 32767)).astype(np.int16)
    elif kind == "aod":
        out = np.rint(np.clip(a * 100.0, -32767, 32767)).astype(np.int16)
    elif kind == "aod_trend":
        out = np.rint(np.clip(a * 10000.0, -32767, 32767)).astype(np.int16)
    elif kind == "no2":
        out = np.rint(np.clip(a * 1000.0, -32767, 32767)).astype(np.int16)
    elif kind == "no2_trend":
        out = np.rint(np.clip(a * 10000.0, -32767, 32767)).astype(np.int16)
    elif kind == "so2_round":
        out = np.rint(np.clip(a, -32767, 32767)).astype(np.int16)
    elif kind == "hu_byte":
        out = np.rint(np.clip(a, 0, 255)).astype(np.uint8)
    else:
        raise ValueError(kind)

    if kind == "hu_byte":
        out = out.astype(np.uint8)
        out[mask] = 0
        return out, gdal.GDT_Byte

    out = out.astype(np.int16)
    out[mask] = INT16_NODATA
    return out, gdal.GDT_Int16


def _write_cog(src_ds: gdal.Dataset, dst_path: Path, data: np.ndarray, gdal_type: int) -> None:
    mem_drv = gdal.GetDriverByName("MEM")
    band_count = src_ds.RasterCount
    if band_count != 1:
        raise RuntimeError(f"Solo 1 banda soportada, hay {band_count}: {dst_path}")
    x, y = src_ds.RasterXSize, src_ds.RasterYSize
    mem = mem_drv.Create("", x, y, 1, gdal_type)
    mem.SetGeoTransform(src_ds.GetGeoTransform())
    mem.SetProjection(src_ds.GetProjection())
    b = mem.GetRasterBand(1)
    b.WriteArray(data)
    if gdal_type == gdal.GDT_Int16:
        b.SetNoDataValue(int(INT16_NODATA))
    elif gdal_type == gdal.GDT_Byte:
        b.SetNoDataValue(0)

    cog_drv = gdal.GetDriverByName("COG")
    if cog_drv is None:
        raise RuntimeError("Driver COG no disponible en GDAL")
    dst_path.parent.mkdir(parents=True, exist_ok=True)
    tmp = dst_path.with_suffix(dst_path.suffix + ".tmp")
    if tmp.exists():
        tmp.unlink()
    cog_drv.CreateCopy(
        str(tmp),
        mem,
        options=[
            "COMPRESS=DEFLATE",
            "LEVEL=9",
            "PREDICTOR=2",
            "OVERVIEW_RESAMPLING=AVERAGE",
        ],
    )
    mem.FlushCache()
    tmp.replace(dst_path)


def _maybe_backup_float(src: Path) -> None:
    bak = src.with_suffix(src.suffix + ".floatbak.tif")
    if bak.exists():
        return
    gdal.GetDriverByName("GTiff").CreateCopy(str(bak), gdal.Open(str(src)), options=["COMPRESS=LZW"])


def _band_is_float(ds: gdal.Dataset) -> bool:
    dt = ds.GetRasterBand(1).DataType
    return dt in (gdal.GDT_Float32, gdal.GDT_Float64)


def process_file(path: Path, kind: str, dry_run: bool) -> None:
    ds = gdal.Open(str(path))
    if ds is None:
        print(f"  SKIP (no abre): {path.name}", file=sys.stderr)
        return
    if not _band_is_float(ds):
        print(f"  SKIP (ya Int16/Byte, use floatbak o fuente original): {path.name}")
        return
    arr = ds.GetRasterBand(1).ReadAsArray()
    out, gdal_type = _quantize_array(arr, kind)
    if dry_run:
        old = path.stat().st_size
        est = out.nbytes
        print(f"  [dry-run] {path.name} {arr.dtype} -> {out.dtype} ~{est} raw ({old:,} bytes on disk)")
        return

    _maybe_backup_float(path)
    tmp = path.with_name(path.name + ".new.tif")
    _write_cog(ds, tmp, out, gdal_type)
    old_size = path.stat().st_size
    tmp.replace(path)
    new_size = path.stat().st_size
    pct = (1 - new_size / old_size) * 100 if old_size else 0
    print(f"  {path.name}: {old_size:,} -> {new_size:,} bytes ({pct:.0f}%)")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--only", help="Etiqueta exacta de QuantSpec.label")
    args = ap.parse_args()
    specs = _specs()
    if args.only:
        specs = [s for s in specs if s.label == args.only]
        if not specs:
            print(f"No hay spec con label {args.only!r}", file=sys.stderr)
            sys.exit(1)

    for spec in specs:
        files = sorted(
            p
            for p in RASTER_ROOT.glob(spec.glob)
            if "floatbak" not in p.name
        )
        if not files:
            print(f"\n[{spec.label}] sin archivos: {spec.glob}")
            continue
        print(f"\n[{spec.label}] {len(files)} archivo(s) [{spec.kind}]")
        for f in files:
            if f.stat().st_size == 0:
                print(f"  SKIP 0 bytes: {f.name}")
                continue
            process_file(f, spec.kind, args.dry_run)


if __name__ == "__main__":
    main()
