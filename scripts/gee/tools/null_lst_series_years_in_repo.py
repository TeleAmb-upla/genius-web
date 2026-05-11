#!/usr/bin/env python3
"""
Pone en ausencia (-9999 en CSV; null en GeoJSON) los años listados en
``LST_NULL_SERIES_YEARS`` para los artefactos LST del repo usados en series y explorador zonal.

Uso (raíz del repo):

    python -m scripts.gee.tools.null_lst_series_years_in_repo
"""
from __future__ import annotations

import csv
import json
import sys
from pathlib import Path

if __name__ == "__main__" and not __package__:
    _repo = Path(__file__).resolve().parents[3]
    _s = str(_repo)
    if _s not in sys.path:
        sys.path.insert(0, _s)
    __package__ = "scripts.gee"

from scripts.gee.products.lst.constants import LST_NULL_SERIES_YEARS

PROJECT_ROOT = Path(__file__).resolve().parents[3]

CSV_SENTINEL = "-9999.000000"

YEARS_DIRS_GEOJSON = (
    (
        PROJECT_ROOT
        / "assets/data/geojson/LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Barrios",
        "LST_Yearly_ZonalStats_Barrios",
    ),
    (
        PROJECT_ROOT
        / "assets/data/geojson/LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Manzanas",
        "LST_Yearly_ZonalStats_Manzanas",
    ),
)


def _null_lst_props(props: dict) -> None:
    for k in list(props.keys()):
        if not k.startswith("LST_"):
            continue
        props[k] = None


def _patch_yearly_geojson(path: Path) -> bool:
    raw = path.read_text(encoding="utf-8", errors="replace")
    try:
        gj = json.loads(raw)
    except json.JSONDecodeError:
        return False
    feats = gj.get("features")
    if not isinstance(feats, list):
        return False
    changed = False
    for feat in feats:
        if not isinstance(feat, dict):
            continue
        p = feat.get("properties")
        if not isinstance(p, dict):
            continue
        before = json.dumps(p, sort_keys=True)
        _null_lst_props(p)
        if json.dumps(p, sort_keys=True) != before:
            changed = True
    if changed:
        path.write_text(
            json.dumps(gj, ensure_ascii=False, separators=(",", ":")) + "\n",
            encoding="utf-8",
        )
    return changed


def _rewrite_csv_yearmonth(path: Path, years: frozenset[int]) -> int:
    if not path.is_file():
        return 0
    rows: list[dict[str, str]] = []
    count = 0
    with path.open(encoding="utf-8", newline="") as f:
        rdr = csv.DictReader(f)
        fieldnames = rdr.fieldnames
        if not fieldnames:
            return 0
        for row in rdr:
            try:
                y = int(row.get("Year") or 0)
            except (TypeError, ValueError):
                rows.append(row)
                continue
            if y in years:
                row["LST_mean"] = CSV_SENTINEL
                count += 1
            rows.append(row)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    return count


def _rewrite_csv_row_if_year(
    path: Path,
    years: frozenset[int],
    *,
    year_field: str,
    numeric_fields: tuple[str, ...],
) -> int:
    if not path.is_file():
        return 0
    rows: list[dict[str, str]] = []
    n = 0
    with path.open(encoding="utf-8", newline="") as f:
        rdr = csv.DictReader(f)
        fieldnames = rdr.fieldnames
        if not fieldnames:
            return 0
        for row in rdr:
            try:
                y = int(float(row.get(year_field) or 0))
            except (TypeError, ValueError):
                rows.append(row)
                continue
            if y in years:
                for col in numeric_fields:
                    if col in row:
                        row[col] = CSV_SENTINEL
                n += 1
            rows.append(row)
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    return n


def main() -> int:
    years = LST_NULL_SERIES_YEARS
    if not years:
        print("LST_NULL_SERIES_YEARS vacío — nada que hacer.")
        return 0
    ys = sorted(years)
    print(f"Años a anular (constantes LST): {ys}")

    p_ym = PROJECT_ROOT / "assets/data/csv/LST_YearMonth_urban.csv"
    n1 = _rewrite_csv_yearmonth(p_ym, years)
    print(f"  LST_YearMonth_urban.csv: {n1} filas → {CSV_SENTINEL}")

    p_yu = PROJECT_ROOT / "assets/data/csv/LST_y_urban.csv"
    n2 = _rewrite_csv_row_if_year(
        p_yu, years, year_field="Year", numeric_fields=("LST_mean", "LST_p25", "LST_p75")
    )
    print(f"  LST_y_urban.csv: {n2} filas")

    p_yzb = PROJECT_ROOT / "assets/data/csv/LST_y_zonal_barrios.csv"
    n3 = _rewrite_csv_row_if_year(
        p_yzb,
        years,
        year_field="Year",
        numeric_fields=("LST_mean", "LST_p25", "LST_p75"),
    )
    print(f"  LST_y_zonal_barrios.csv: {n3} filas")

    geo_changed = 0
    for stem_dir, stem_prefix in YEARS_DIRS_GEOJSON:
        if not stem_dir.is_dir():
            continue
        for y in ys:
            fp = stem_dir / f"{stem_prefix}_{y}.geojson"
            if fp.is_file() and _patch_yearly_geojson(fp):
                geo_changed += 1
                print(f"  GeoJSON LST_mean→null: {fp.relative_to(PROJECT_ROOT)}")

    print(f"Hecho ({geo_changed} archivos GeoJSON anuales tocados).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
