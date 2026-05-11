#!/usr/bin/env python3
"""
Rellena columnas P25/P75 en CSV anuales cuando faltan: misma idea que el visor
(cuantiles sobre los escalares mensuales por año). Tras reexportar desde GEE con
``median_of_monthly_*_p25p75`` en los ``csv_tasks``, el CSV ya trae esas columnas
y el front las prioriza; este script queda como respaldo para copias antiguas.
"""
from __future__ import annotations

import csv
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
CSV_DIR = ROOT / "assets" / "data" / "csv"

GENIUS_SENTINEL = -9999.0


def parse_monthly_val(raw: str) -> float | None:
    s = (raw or "").strip()
    if s == "":
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


def quantile_sorted(sorted_vals: list[float], q: float) -> float:
    if not sorted_vals:
        return float("nan")
    n = len(sorted_vals)
    if n == 1:
        return sorted_vals[0]
    pos = (n - 1) * q
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    if lo == hi:
        return sorted_vals[lo]
    return sorted_vals[lo] + (sorted_vals[hi] - sorted_vals[lo]) * (pos - lo)


def load_csv(path: Path) -> tuple[list[str], list[dict[str, str]], str]:
    text = path.read_text(encoding="utf-8")
    delimiter = ";" if ";" in text.splitlines()[0] else ","
    with path.open(encoding="utf-8", newline="") as f:
        r = csv.DictReader(f, delimiter=delimiter)
        fieldnames = list(r.fieldnames or [])
        rows = list(r)
    return fieldnames, rows, delimiter


def year_month_buckets(
    ym_path: Path,
    value_col: str,
    year_col: str = "Year",
    *,
    ndvi_physical_range: bool = False,
) -> dict[int, list[float]]:
    if not ym_path.exists():
        return {}
    _, ym_rows, _ = load_csv(ym_path)
    by_year: dict[int, list[float]] = {}
    for row in ym_rows:
        try:
            y = int(round(float(row.get(year_col, "").strip() or "nan")))
        except ValueError:
            continue
        v = parse_monthly_val(row.get(value_col, ""))
        if v is None:
            continue
        if ndvi_physical_range and (v < -1.0 or v > 1.0):
            continue
        by_year.setdefault(y, []).append(v)
    return by_year


def apply_intra_annual(
    rows: list[dict[str, str]],
    by_year: dict[int, list[float]],
    year_col: str,
    mid_key: str,
    p25_key: str,
    p75_key: str,
    *,
    mid_decimals: int | None = None,
) -> None:
    """
    P25/P75 intra-anuales sobre los valores mensuales. Si ``mid_decimals`` no es
    None, también actualiza ``mid_key`` con el P50 (mediana) de esa misma serie
    (alinea línea y banda cuando el insumo es un CSV año–mes en disco).
    """
    for r in rows:
        try:
            y = int(round(float(r.get(year_col, "").strip() or "nan")))
        except ValueError:
            r[p25_key] = ""
            r[p75_key] = ""
            if mid_decimals is not None:
                r[mid_key] = ""
            continue
        vals = by_year.get(y)
        if not vals:
            r[p25_key] = ""
            r[p75_key] = ""
            if mid_decimals is not None:
                r[mid_key] = ""
            continue
        s = sorted(vals)
        p25 = quantile_sorted(s, 0.25)
        p50 = quantile_sorted(s, 0.5)
        p75 = quantile_sorted(s, 0.75)
        r[p25_key] = "" if math.isnan(p25) else f"{p25:.10g}"
        r[p75_key] = "" if math.isnan(p75) else f"{p75:.10g}"
        if mid_decimals is not None:
            r[mid_key] = (
                "" if math.isnan(p50) else f"{p50:.{mid_decimals}f}"
            )


def write_rows(path: Path, fieldnames: list[str], rows: list[dict[str, str]]) -> None:
    text = path.read_text(encoding="utf-8")
    delimiter = ";" if ";" in text.splitlines()[0] else ","
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, delimiter=delimiter, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def write_rows_create(
    path: Path,
    fieldnames: list[str],
    rows: list[dict[str, str]],
    *,
    delimiter: str = ",",
) -> None:
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, delimiter=delimiter, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)


def annual_rows_from_year_month(
    by_year: dict[int, list[float]],
    year_col: str,
    mid_key: str,
    p25_key: str,
    p75_key: str,
    *,
    mid_decimals: int | None = None,
) -> list[dict[str, str]]:
    """Una fila por año con mediana (o P50) y P25/P75 intraanuales desde meses."""
    rows: list[dict[str, str]] = []
    for y in sorted(by_year.keys()):
        vals = by_year[y]
        if not vals:
            continue
        s = sorted(vals)
        p25 = quantile_sorted(s, 0.25)
        p50 = quantile_sorted(s, 0.5)
        p75 = quantile_sorted(s, 0.75)
        mid_s = (
            ""
            if math.isnan(p50)
            else (
                f"{p50:.{mid_decimals}f}"
                if mid_decimals is not None
                else f"{p50:.10g}"
            )
        )
        rows.append(
            {
                year_col: str(y),
                mid_key: mid_s,
                p25_key: "" if math.isnan(p25) else f"{p25:.10g}",
                p75_key: "" if math.isnan(p75) else f"{p75:.10g}",
            }
        )
    return rows


def main() -> None:
    jobs: list[tuple[Path, Path, str, str, str, str, int | None]] = [
        (
            CSV_DIR / "LST_y_urban.csv",
            CSV_DIR / "LST_YearMonth_urban.csv",
            "Year",
            "LST_mean",
            "LST_p25",
            "LST_p75",
            None,
        ),
        (
            CSV_DIR / "AOD_y_urban.csv",
            CSV_DIR / "AOD_YearMonth_urban.csv",
            "Year",
            "AOD_median",
            "AOD_p25",
            "AOD_p75",
            None,
        ),
        (
            CSV_DIR / "NO2_y_urban.csv",
            CSV_DIR / "NO2_YearMonth_urban.csv",
            "Year",
            "NO2_median",
            "NO2_p25",
            "NO2_p75",
            None,
        ),
        (
            CSV_DIR / "SO2_y_urban.csv",
            CSV_DIR / "SO2_YearMonth_urban.csv",
            "Year",
            "SO2",
            "SO2_p25",
            "SO2_p75",
            None,
        ),
    ]

    for annual_path, ym_path, yk, vk, p25k, p75k, mid_decimals in jobs:
        by_year = year_month_buckets(
            ym_path,
            vk,
            ndvi_physical_range=(vk == "NDVI"),
        )
        if not annual_path.exists():
            if not ym_path.exists() or not by_year:
                print("skip missing (no annual, no ym)", annual_path)
                continue
            fieldnames = [yk, vk, p25k, p75k]
            rows = annual_rows_from_year_month(
                by_year, yk, vk, p25k, p75k, mid_decimals=mid_decimals
            )
            write_rows_create(annual_path, fieldnames, rows)
            print("created", annual_path.name, "from", ym_path.name, f"({len(rows)} años)")
            continue
        fieldnames, rows, _ = load_csv(annual_path)
        for k in (p25k, p75k):
            if k not in fieldnames:
                fieldnames.append(k)
        apply_intra_annual(
            rows, by_year, yk, vk, p25k, p75k, mid_decimals=mid_decimals
        )
        write_rows(annual_path, fieldnames, rows)
        print("updated", annual_path.name, "from", ym_path.name)


if __name__ == "__main__":
    main()
