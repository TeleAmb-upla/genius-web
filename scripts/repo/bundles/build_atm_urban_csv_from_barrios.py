#!/usr/bin/env python3
"""
Genera CSV urbanos (mediana espacial entre barrios Quilpué) para AOD, NO₂ y SO₂.

Misma metodología que AOD: serie anual desde GeoJSON anual, climatología mensual
desde GeoJSON mensual, año–mes sintético (climatología × factor anual / media climática),
y ``anio_actual`` con respeto al muro Chile (sin CSV regional de respaldo).

SO₂ en GeoJSON anual puede venir en mol/m² (|v| < 1); se convierte a µmol/m² como en so2_units.js.

Uso:
  python3 scripts/repo/bundles/build_atm_urban_csv_from_barrios.py
  python3 scripts/repo/csv/fill_annual_csv_pctl.py
"""
from __future__ import annotations

import csv
import json
import math
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[3]
CSV_DIR = ROOT / "assets" / "data" / "csv"
GEO_ROOT = ROOT / "assets" / "data" / "geojson"
GENIUS_SENTINEL = -9999.0


@dataclass(frozen=True)
class AtmUrbanProduct:
    tag: str
    yearly_dir_parts: tuple[str, ...]
    monthly_dir_parts: tuple[str, ...]
    yearly_glob: str
    monthly_filename: str  # "Prefix_Barrios_{month:02d}.geojson"
    y_urban: str
    ym_urban: str
    m_urban: str
    geo_value_prop: str
    yearly_median_col: str
    yearly_p25_col: str
    yearly_p75_col: str
    ym_value_col: str
    anio_direct_min: float


PRODUCTS: tuple[AtmUrbanProduct, ...] = (
    AtmUrbanProduct(
        tag="AOD",
        yearly_dir_parts=("AOD", "AOD_Yearly_ZonalStats", "AOD_Yearly_ZonalStats_Barrios"),
        monthly_dir_parts=("AOD", "AOD_Monthly_ZonalStats", "AOD_Monthly_ZonalStats_Barrios"),
        yearly_glob="AOD_Yearly_ZonalStats_Barrios_*.geojson",
        monthly_filename="AOD_Monthly_ZonalStats_Barrios_{month:02d}.geojson",
        y_urban="AOD_y_urban.csv",
        ym_urban="AOD_YearMonth_urban.csv",
        m_urban="AOD_m_urban.csv",
        geo_value_prop="AOD_median",
        yearly_median_col="AOD_median",
        yearly_p25_col="AOD_p25",
        yearly_p75_col="AOD_p75",
        ym_value_col="AOD_median",
        anio_direct_min=5.0,
    ),
    AtmUrbanProduct(
        tag="NO2",
        yearly_dir_parts=("NO2", "NO2_Yearly_ZonalStats", "NO2_Yearly_ZonalStats_Barrios"),
        monthly_dir_parts=("NO2", "NO2_Monthly_ZonalStats", "NO2_Monthly_ZonalStats_Barrios"),
        yearly_glob="NO2_Yearly_ZonalStats_Barrios_*.geojson",
        monthly_filename="NO2_Monthly_ZonalStats_Barrios_{month:02d}.geojson",
        y_urban="NO2_y_urban.csv",
        ym_urban="NO2_YearMonth_urban.csv",
        m_urban="NO2_m_urban.csv",
        geo_value_prop="NO2_median",
        yearly_median_col="NO2_median",
        yearly_p25_col="NO2_p25",
        yearly_p75_col="NO2_p75",
        ym_value_col="NO2_median",
        anio_direct_min=0.5,
    ),
    AtmUrbanProduct(
        tag="SO2",
        yearly_dir_parts=("SO2", "SO2_Yearly_ZonalStats", "SO2_Yearly_ZonalStats_Barrios"),
        monthly_dir_parts=("SO2", "SO2_Monthly_ZonalStats", "SO2_Monthly_ZonalStats_Barrios"),
        yearly_glob="SO2_Yearly_ZonalStats_Barrios_*.geojson",
        monthly_filename="SO2_Monthly_ZonalStats_Barrios_{month:02d}.geojson",
        y_urban="SO2_y_urban.csv",
        ym_urban="SO2_YearMonth_urban.csv",
        m_urban="SO2_m_urban.csv",
        geo_value_prop="SO2",
        yearly_median_col="SO2",
        yearly_p25_col="SO2_p25",
        yearly_p75_col="SO2_p75",
        ym_value_col="SO2",
        anio_direct_min=1.0,
    ),
)


def _wall_calendar_year_month_chile() -> tuple[int, int]:
    try:
        from zoneinfo import ZoneInfo

        now = datetime.now(ZoneInfo("America/Santiago"))
        y, m = now.year, now.month
    except Exception:
        now = datetime.utcnow()
        y, m = now.year, now.month
    if m == 1:
        return y - 1, 12
    return y, m - 1


def _parse_float(s: str | None) -> float | None:
    if s is None or str(s).strip() == "":
        return None
    try:
        v = float(s)
    except ValueError:
        return None
    if not math.isfinite(v):
        return None
    if abs(v - GENIUS_SENTINEL) < 0.501:
        return None
    return v


def _so2_umol_for_display(v: float) -> float | None:
    if not math.isfinite(v):
        return None
    return v * 1e6 if abs(v) < 1.0 else v


def _geo_scalar(product: AtmUrbanProduct, raw: float | None) -> float | None:
    if raw is None:
        return None
    if product.tag == "SO2":
        return _so2_umol_for_display(raw)
    return raw


def _read_csv_dicts(path: Path) -> tuple[list[str], list[dict[str, str]], str]:
    text = path.read_text(encoding="utf-8")
    delimiter = ";" if ";" in text.splitlines()[0] else ","
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f, delimiter=delimiter)
        fieldnames = list(reader.fieldnames or [])
        rows = list(reader)
    return fieldnames, rows, delimiter


def _write_csv(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, delimiter=",", lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def _year_to_median(path: Path, col: str) -> dict[int, float]:
    if not path.exists():
        return {}
    _, rows, _ = _read_csv_dicts(path)
    out: dict[int, float] = {}
    for row in rows:
        yv = _parse_float(str(row.get("Year", "")))
        mv = _parse_float(str(row.get(col, "")))
        if yv is None or mv is None:
            continue
        out[int(round(yv))] = mv
    return out


def _load_yearly_urban(product: AtmUrbanProduct) -> list[dict[str, str]]:
    geo_y = GEO_ROOT.joinpath(*product.yearly_dir_parts)
    if not geo_y.is_dir():
        raise SystemExit(f"[{product.tag}] Missing {geo_y}")
    rows_out: list[dict[str, str]] = []
    for p in sorted(geo_y.glob(product.yearly_glob)):
        if "Trend_" in p.name:
            continue
        try:
            year = int(p.stem.split("_")[-1])
        except ValueError:
            continue
        data = json.loads(p.read_text(encoding="utf-8"))
        vals: list[float] = []
        for f in data.get("features") or []:
            props = f.get("properties") or {}
            raw = _parse_float(str(props.get(product.geo_value_prop, "")))
            v = _geo_scalar(product, raw)
            if v is None:
                continue
            vals.append(v)
        if not vals:
            continue
        arr = np.array(vals, dtype=np.float64)
        rows_out.append(
            {
                "Year": str(year),
                product.yearly_median_col: f"{float(np.median(arr)):.10g}",
                product.yearly_p25_col: f"{float(np.percentile(arr, 25)):.10g}",
                product.yearly_p75_col: f"{float(np.percentile(arr, 75)):.10g}",
            }
        )
    rows_out.sort(key=lambda r: int(r["Year"]))
    return rows_out


def _load_monthly_clim(product: AtmUrbanProduct) -> list[dict[str, str]]:
    geo_m = GEO_ROOT.joinpath(*product.monthly_dir_parts)
    if not geo_m.is_dir():
        raise SystemExit(f"[{product.tag}] Missing {geo_m}")
    rows: list[dict[str, str]] = []
    for mo in range(1, 13):
        p = geo_m / product.monthly_filename.format(month=mo)
        if not p.exists():
            raise SystemExit(f"[{product.tag}] Missing {p}")
        data = json.loads(p.read_text(encoding="utf-8"))
        vals: list[float] = []
        for f in data.get("features") or []:
            props = f.get("properties") or {}
            raw = _parse_float(str(props.get(product.geo_value_prop, "")))
            v = _geo_scalar(product, raw)
            if v is None:
                continue
            vals.append(v)
        if not vals:
            rows.append(
                {
                    "Month": str(mo),
                    product.yearly_median_col: "",
                    product.yearly_p25_col: "",
                    product.yearly_p75_col: "",
                    "anio_actual": f"{GENIUS_SENTINEL:.6f}",
                }
            )
            continue
        arr = np.array(vals, dtype=np.float64)
        rows.append(
            {
                "Month": str(mo),
                product.yearly_median_col: f"{float(np.median(arr)):.10g}",
                product.yearly_p25_col: f"{float(np.percentile(arr, 25)):.10g}",
                product.yearly_p75_col: f"{float(np.percentile(arr, 75)):.10g}",
                "anio_actual": "",
            }
        )
    return rows


def _build_yearmonth_from_climatology(
    product: AtmUrbanProduct,
    urban_y: dict[int, float],
    month_clim: dict[int, float],
) -> list[dict[str, str]]:
    vals = [v for v in month_clim.values() if v and v > 0]
    clim_mean = float(np.mean(vals)) if vals else 1.0
    if clim_mean <= 0:
        clim_mean = 1.0
    years = sorted(urban_y.keys())
    out: list[dict[str, str]] = []
    for y in years:
        uy = urban_y[y]
        factor = uy / clim_mean if clim_mean > 0 else 1.0
        for m in range(1, 13):
            base = month_clim.get(m)
            if base is None or base <= 0:
                continue
            val = base * factor
            out.append(
                {
                    "Year": str(y),
                    "Month": str(m),
                    product.ym_value_col: f"{val:.6f}",
                }
            )
    return out



def _apply_anio_actual(
    product: AtmUrbanProduct,
    monthly_rows: list[dict[str, str]],
    ym_urban: list[dict[str, str]],
    wall_y: int,
    wall_m: int,
) -> None:
    ym_index = {
        (int(r["Year"]), int(round(float(r["Month"])))): r for r in ym_urban
    }
    med = product.yearly_median_col
    for row in monthly_rows:
        mo = int(row["Month"])
        if mo > wall_m:
            row["anio_actual"] = f"{GENIUS_SENTINEL:.6f}"
            continue
        key = (wall_y, mo)
        ru = ym_index.get(key)
        v = _parse_float(ru.get(product.ym_value_col, "")) if ru else None
        if v is not None and v > product.anio_direct_min:
            row["anio_actual"] = f"{v:.6f}"
        else:
            row["anio_actual"] = f"{GENIUS_SENTINEL:.6f}"


def build_one(product: AtmUrbanProduct) -> None:
    urban_rows = _load_yearly_urban(product)
    if not urban_rows:
        print(f"[{product.tag}] skip — no yearly barrio rows")
        return
    p_y = CSV_DIR / product.y_urban
    fieldnames_y = ["Year", product.yearly_median_col, product.yearly_p25_col, product.yearly_p75_col]
    _write_csv(p_y, fieldnames_y, urban_rows)
    print("wrote", p_y.relative_to(ROOT), f"({len(urban_rows)} years)")

    monthly_rows = _load_monthly_clim(product)
    month_clim: dict[int, float] = {}
    med = product.yearly_median_col
    for row in monthly_rows:
        mo = int(row["Month"])
        v = _parse_float(row.get(med, ""))
        if v is not None and v > 0:
            month_clim[mo] = v

    urban_y = _year_to_median(p_y, med)
    wy, wm = _wall_calendar_year_month_chile()
    urban_y_ym = dict(urban_y)
    if urban_y_ym and wy not in urban_y_ym:
        urban_y_ym[wy] = urban_y_ym[max(urban_y_ym.keys())]

    ym_urban = _build_yearmonth_from_climatology(product, urban_y_ym, month_clim)
    p_ym = CSV_DIR / product.ym_urban
    _write_csv(p_ym, ["Year", "Month", product.ym_value_col], ym_urban)
    print("wrote", p_ym.relative_to(ROOT), f"({len(ym_urban)} rows)")

    _apply_anio_actual(product, monthly_rows, ym_urban, wy, wm)
    p_m = CSV_DIR / product.m_urban
    fieldnames_m = ["Month", med, product.yearly_p25_col, product.yearly_p75_col, "anio_actual"]
    _write_csv(p_m, fieldnames_m, monthly_rows)
    print("wrote", p_m.relative_to(ROOT))


def main() -> None:
    for p in PRODUCTS:
        build_one(p)


if __name__ == "__main__":
    main()
