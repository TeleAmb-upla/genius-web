#!/usr/bin/env python3
"""
Sample rasters + zonal GeoJSON in assets/data to build legend domains using
**5th / 95th percentiles** over valid pixels / features (same idea as the
older hand-tuned p5–p95 ranges, not raw min/max / p0–p100).

Regenerates assets/js/legend_ranges.js when run from repo root:

    python3 scripts/repo/legends/compute_legend_histogram_ranges.py

Requires: numpy, tifffile (pip install tifffile)
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np

try:
    import tifffile
except ImportError as e:
    print("Install tifffile: pip install tifffile", file=sys.stderr)
    raise SystemExit(1) from e

REPO = Path(__file__).resolve().parents[3]
RASTER_ROOT = REPO / "assets" / "data" / "raster"
GEOJSON_ROOT = REPO / "assets" / "data" / "geojson"
OUT_JS = REPO / "assets" / "js" / "legend_ranges.js"

# Subsample stride per axis (full min/max still reflects sampled histogram support)
STRIDE = 4


def so2_umol_for_display(v: float) -> float | None:
    if v is None or (isinstance(v, float) and math.isnan(v)):
        return None
    n = float(v)
    if not math.isfinite(n):
        return None
    return n * 1e6 if abs(n) < 1 else n


def raster_percentile_range(
    paths: list[Path], *, lo_pct: float = 5.0, hi_pct: float = 95.0
) -> tuple[float, float] | None:
    """Per-file p5/p95 on subsampled pixels; envelope = min(lower) / max(upper)."""
    glo_lo, glo_hi = np.inf, -np.inf
    any_ok = False
    for p in paths:
        if not p.is_file():
            continue
        try:
            with tifffile.TiffFile(p) as t:
                a = t.asarray(out="memmap")
        except Exception:
            continue
        if a.size == 0:
            continue
        sl = a[::STRIDE, ::STRIDE] if a.ndim >= 2 else a[::STRIDE]
        x = np.asarray(sl, dtype=np.float64)
        x = x[np.isfinite(x)]
        if x.size == 0:
            continue
        pl = float(np.percentile(x, lo_pct))
        ph = float(np.percentile(x, hi_pct))
        glo_lo = min(glo_lo, pl)
        glo_hi = max(glo_hi, ph)
        any_ok = True
    if not any_ok or not math.isfinite(glo_lo) or not math.isfinite(glo_hi):
        return None
    if glo_lo == glo_hi:
        glo_hi = glo_lo + 1e-9
    return glo_lo, glo_hi


def collect_geojson_values(
    glob_pat: str,
    prop: str,
    *,
    transform=None,
) -> list[float]:
    out: list[float] = []
    for p in sorted(GEOJSON_ROOT.glob(glob_pat)):
        try:
            data = json.loads(p.read_text(encoding="utf-8"))
        except Exception:
            continue
        for feat in data.get("features") or []:
            props = feat.get("properties") or {}
            raw = props.get(prop)
            if raw is None:
                continue
            try:
                v = float(raw)
            except (TypeError, ValueError):
                continue
            if not math.isfinite(v):
                continue
            if transform:
                v = transform(v)
                if v is None or not math.isfinite(v):
                    continue
            out.append(v)
    return out


def geojson_percentile_range(
    glob_pat: str, prop: str, *, transform=None, lo_pct: float = 5.0, hi_pct: float = 95.0
) -> tuple[float, float] | None:
    vals = collect_geojson_values(glob_pat, prop, transform=transform)
    if not vals:
        return None
    a = np.asarray(vals, dtype=np.float64)
    return float(np.percentile(a, lo_pct)), float(np.percentile(a, hi_pct))


def widen_flat(lo: float, hi: float) -> tuple[float, float]:
    """Avoid zero-width domains (diverging scales break)."""
    if hi < lo:
        lo, hi = hi, lo
    if math.isclose(lo, hi, rel_tol=0, abs_tol=1e-15):
        pad = max(abs(lo) * 0.02, 1e-6)
        return lo - pad, hi + pad
    return lo, hi


def fmt_pair(lo: float, hi: float) -> str:
    lo, hi = widen_flat(lo, hi)

    def r(x: float) -> str:
        if abs(x) >= 1000 or (abs(x) < 0.01 and x != 0):
            return f"{x:.6g}"
        if abs(x) >= 1:
            return f"{x:.4g}".rstrip("0").rstrip(".")
        return f"{x:.6g}"

    return f"Object.freeze({{ min: {r(lo)}, max: {r(hi)} }})"


def main() -> None:
    ndvi_y = raster_percentile_range(sorted((RASTER_ROOT / "NDVI" / "NDVI_Yearly").glob("*.tif")))
    ndvi_m = raster_percentile_range(sorted((RASTER_ROOT / "NDVI" / "NDVI_Monthly").glob("*.tif")))
    ndvi_t = raster_percentile_range(sorted((RASTER_ROOT / "NDVI" / "NDVI_Trend").glob("*.tif")))
    ndvi_sd = raster_percentile_range(sorted((RASTER_ROOT / "NDVI" / "NDVI_SD").glob("*.tif")))

    lst_y = raster_percentile_range(sorted((RASTER_ROOT / "LST" / "LST_Yearly").glob("*.tif")))
    lst_m = raster_percentile_range(sorted((RASTER_ROOT / "LST" / "LST_Monthly").glob("*.tif")))
    lst_t = raster_percentile_range(sorted((RASTER_ROOT / "LST" / "LST_Trend").glob("*.tif")))

    aod_y = raster_percentile_range(sorted((RASTER_ROOT / "AOD" / "AOD_Yearly").glob("*.tif")))
    aod_m = raster_percentile_range(sorted((RASTER_ROOT / "AOD" / "AOD_Monthly").glob("*.tif")))
    aod_t = raster_percentile_range(sorted((RASTER_ROOT / "AOD" / "AOD_Trend").glob("*.tif")))

    no2_y = raster_percentile_range(sorted((RASTER_ROOT / "NO2" / "NO2_Yearly").glob("*.tif")))
    no2_m = raster_percentile_range(sorted((RASTER_ROOT / "NO2" / "NO2_Monthly").glob("*.tif")))
    no2_t = raster_percentile_range(sorted((RASTER_ROOT / "NO2" / "NO2_Trend").glob("*.tif")))

    so2_y = raster_percentile_range(sorted((RASTER_ROOT / "SO2" / "SO2_Yearly").glob("*.tif")))
    so2_m = raster_percentile_range(sorted((RASTER_ROOT / "SO2" / "SO2_Monthly").glob("*.tif")))
    so2_t = raster_percentile_range(sorted((RASTER_ROOT / "SO2" / "SO2_Trend").glob("*.tif")))

    # Zonal — NDVI property is "NDVI"; LST uses LST_mean; AOD AOD_median; NO2 NO2_median; SO2 SO2 (µmol display)
    z_ndvi_b_y = geojson_percentile_range("NDVI/NDVI_Yearly_ZonalStats/NDVI_Yearly_ZonalStats_Barrios/*.geojson", "NDVI")
    z_ndvi_b_m = geojson_percentile_range("NDVI/NDVI_Monthly_ZonalStats/NDVI_Monthly_ZonalStats_Barrios/*.geojson", "NDVI")
    z_ndvi_m_y = geojson_percentile_range("NDVI/NDVI_Yearly_ZonalStats/NDVI_Yearly_ZonalStats_Manzanas/*.geojson", "NDVI")
    z_ndvi_m_m = geojson_percentile_range("NDVI/NDVI_Monthly_ZonalStats/NDVI_Monthly_ZonalStats_Manzanas/*.geojson", "NDVI")

    z_lst_b_y = geojson_percentile_range("LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Barrios/*.geojson", "LST_mean")
    z_lst_b_m = geojson_percentile_range("LST/LST_Monthly_ZonalStats/LST_Monthly_ZonalStats_Barrios/*.geojson", "LST_mean")
    z_lst_m_y = geojson_percentile_range("LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Manzanas/*.geojson", "LST_mean")
    z_lst_m_m = geojson_percentile_range("LST/LST_Monthly_ZonalStats/LST_Monthly_ZonalStats_Manzanas/*.geojson", "LST_mean")

    z_aod_b_y = geojson_percentile_range("AOD/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Barrios/*.geojson", "AOD_median")
    z_aod_b_m = geojson_percentile_range("AOD/AOD_Monthly_ZonalStats/AOD_Monthly_ZonalStats_Barrios/*.geojson", "AOD_median")
    z_aod_m_y = geojson_percentile_range("AOD/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Manzanas/*.geojson", "AOD_median")
    z_aod_m_m = geojson_percentile_range("AOD/AOD_Monthly_ZonalStats/AOD_Monthly_ZonalStats_Manzanas/*.geojson", "AOD_median")

    z_no2_b_y = geojson_percentile_range("NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Barrios/*.geojson", "NO2_median")
    z_no2_b_m = geojson_percentile_range("NO2/NO2_Monthly_ZonalStats/NO2_Monthly_ZonalStats_Barrios/*.geojson", "NO2_median")
    z_no2_m_y = geojson_percentile_range("NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Manzanas/*.geojson", "NO2_median")
    z_no2_m_m = geojson_percentile_range("NO2/NO2_Monthly_ZonalStats/NO2_Monthly_ZonalStats_Manzanas/*.geojson", "NO2_median")

    z_so2_b_y = geojson_percentile_range(
        "SO2/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Barrios/*.geojson",
        "SO2",
        transform=so2_umol_for_display,
    )
    z_so2_b_m = geojson_percentile_range(
        "SO2/SO2_Monthly_ZonalStats/SO2_Monthly_ZonalStats_Barrios/*.geojson",
        "SO2",
        transform=so2_umol_for_display,
    )
    z_so2_m_y = geojson_percentile_range(
        "SO2/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Manzanas/*.geojson",
        "SO2",
        transform=so2_umol_for_display,
    )
    z_so2_m_m = geojson_percentile_range(
        "SO2/SO2_Monthly_ZonalStats/SO2_Monthly_ZonalStats_Manzanas/*.geojson",
        "SO2",
        transform=so2_umol_for_display,
    )

    # Trends (slope_median) — one file per scope/product
    t_ndvi_b = geojson_percentile_range("NDVI/NDVI_Yearly_ZonalStats/NDVI_Yearly_ZonalStats_Barrios/Trend_*.geojson", "slope_median")
    t_ndvi_m = geojson_percentile_range("NDVI/NDVI_Yearly_ZonalStats/NDVI_Yearly_ZonalStats_Manzanas/Trend_*.geojson", "slope_median")
    t_lst_b = geojson_percentile_range("LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Barrios/Trend_*.geojson", "slope_median")
    t_lst_m = geojson_percentile_range("LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Manzanas/Trend_*.geojson", "slope_median")
    t_aod_b = geojson_percentile_range("AOD/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Barrios/Trend_*.geojson", "slope_median")
    t_aod_m = geojson_percentile_range("AOD/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Manzanas/Trend_*.geojson", "slope_median")
    t_no2_b = geojson_percentile_range("NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Barrios/Trend_*.geojson", "slope_median")
    t_no2_m = geojson_percentile_range("NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Manzanas/Trend_*.geojson", "slope_median")
    # Tendencia: slope_median en las mismas unidades que el raster de tendencia (sin conversión µmol)
    t_so2_b = geojson_percentile_range(
        "SO2/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Barrios/Trend_*.geojson",
        "slope_median",
    )
    t_so2_m = geojson_percentile_range(
        "SO2/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Manzanas/Trend_*.geojson",
        "slope_median",
    )

    def row(raster_pair, z_b_y, z_b_m, z_m_y, z_m_m, tr_b, tr_m):
        ry, rm, rt = raster_pair
        return ry, rm, rt, z_b_y, z_b_m, z_m_y, z_m_m, tr_b, tr_m

    packs = {
        "ndvi": (ndvi_y, ndvi_m, ndvi_t, z_ndvi_b_y, z_ndvi_b_m, z_ndvi_m_y, z_ndvi_m_m, t_ndvi_b, t_ndvi_m),
        "lst": (lst_y, lst_m, lst_t, z_lst_b_y, z_lst_b_m, z_lst_m_y, z_lst_m_m, t_lst_b, t_lst_m),
        "aod": (aod_y, aod_m, aod_t, z_aod_b_y, z_aod_b_m, z_aod_m_y, z_aod_m_m, t_aod_b, t_aod_m),
        "no2": (no2_y, no2_m, no2_t, z_no2_b_y, z_no2_b_m, z_no2_m_y, z_no2_m_m, t_no2_b, t_no2_m),
        "so2": (so2_y, so2_m, so2_t, z_so2_b_y, z_so2_b_m, z_so2_m_y, z_so2_m_m, t_so2_b, t_so2_m),
    }

    # Fallback if any None (missing data) — use conservative prior from old legend_ranges
    fallbacks = {
        "ndvi": {"y": (-0.05, 0.65), "m": (-0.05, 0.70), "t": (-0.01, 0.01)},
        "lst": {"y": (18, 38), "m": (10, 42), "t": (-0.22, 0.22)},
        "aod": {"y": (88, 113), "m": (75, 130), "t": (-38, 38)},
        "no2": {"y": (10, 15), "m": (10, 27), "t": (-0.93, 0.93)},
        "so2": {"y": (0, 500), "m": (0, 500), "t": (-170, 170)},
    }

    def pick(pair, fb):
        if pair is None:
            return fb
        return pair

    lines = []
    lines.append("/**")
    lines.append(" * Legend domains from p5–p95 over sampled rasters + zonal GeoJSON.")
    lines.append(" * Regenerate: python3 scripts/repo/legends/compute_legend_histogram_ranges.py")
    lines.append(" */")
    lines.append("export const LEGEND_RANGES = Object.freeze({")

    for key, (
        ry,
        rm,
        rt,
        zb_y,
        zb_m,
        zm_y,
        zm_m,
        tb,
        tm,
    ) in packs.items():
        fb = fallbacks[key]
        ry = pick(ry, fb["y"])
        rm = pick(rm, fb["m"])
        rt = pick(rt, fb["t"])
        zb_y = pick(zb_y, ry)
        zb_m = pick(zb_m, rm)
        zm_y = pick(zm_y, ry)
        zm_m = pick(zm_m, rm)
        tb = pick(tb, rt)
        tm = pick(tm, rt)

        lines.append(f"    {key}: Object.freeze({{")
        lines.append("        raster: Object.freeze({")
        lines.append(f"            yearly: {fmt_pair(*ry)},")
        lines.append(f"            monthly: {fmt_pair(*rm)},")
        lines.append(f"            trend: {fmt_pair(*rt)},")
        lines.append("        }),")
        lines.append("        zonalBarrio: Object.freeze({")
        lines.append(f"            yearly: {fmt_pair(*zb_y)},")
        lines.append(f"            monthly: {fmt_pair(*zb_m)},")
        lines.append(f"            trend: {fmt_pair(*tb)},")
        lines.append("        }),")
        lines.append("        zonalManzana: Object.freeze({")
        lines.append(f"            yearly: {fmt_pair(*zm_y)},")
        lines.append(f"            monthly: {fmt_pair(*zm_m)},")
        lines.append(f"            trend: {fmt_pair(*tm)},")
        lines.append("        }),")
        lines.append("    }),")

    if ndvi_sd:
        lines.append(f"    ndviStdDev: {fmt_pair(*ndvi_sd)},")
    else:
        lines.append("    ndviStdDev: Object.freeze({ min: 0, max: 0.22 }),")

    lines.append("});")
    lines.append("")
    lines.append("/**")
    lines.append(" * @param {'ndvi'|'lst'|'aod'|'no2'|'so2'} product")
    lines.append(" * @param {'raster'|'zonalBarrio'|'zonalManzana'} scope")
    lines.append(" * @param {'yearly'|'monthly'|'trend'} mode")
    lines.append(" */")
    lines.append("export function legendDomain(product, scope, mode) {")
    lines.append("    const p = LEGEND_RANGES[product];")
    lines.append("    if (!p) return null;")
    lines.append("    const s = p[scope];")
    lines.append("    if (!s) return null;")
    lines.append("    const row = s[mode];")
    lines.append("    return row ? [row.min, row.max] : null;")
    lines.append("}")
    lines.append("")
    lines.append("export function ndviStdDevLegendDomain() {")
    lines.append("    const d = LEGEND_RANGES.ndviStdDev;")
    lines.append("    return [d.min, d.max];")
    lines.append("}")
    lines.append("")
    lines.append("/** @deprecated Use legendDomain(product, 'raster', mode) */")
    lines.append("export function getLegendRange(product, mode) {")
    lines.append("    return legendDomain(product, 'raster', mode);")
    lines.append("}")

    OUT_JS.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT_JS.relative_to(REPO)}")


if __name__ == "__main__":
    main()
