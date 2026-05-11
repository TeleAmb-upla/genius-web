#!/usr/bin/env python3
"""
Construye JSON centralizado por barrio para el modal LST «Explorar series».
Misma estructura lógica que NDVI: GeoJSON anuales/mensuales + CSV GEE opcionales.

Salida:
- assets/data/csv/LST_zonal_explorer_barrios.json

Uso (desde la raíz del repo):
    python scripts/repo/bundles/build_lst_zonal_explorer_bundle.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))
from scripts.gee.products.lst.constants import LST_NULL_SERIES_YEARS

DIR_YEARLY_B = PROJECT_ROOT / (
    "assets/data/geojson/LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Barrios"
)
DIR_MONTHLY_B = PROJECT_ROOT / (
    "assets/data/geojson/LST/LST_Monthly_ZonalStats/LST_Monthly_ZonalStats_Barrios"
)

CSV_M_ZONAL_B = PROJECT_ROOT / "assets/data/csv/LST_m_zonal_barrios.csv"

CSV_Y_ZONAL_B = PROJECT_ROOT / "assets/data/csv/LST_y_zonal_barrios.csv"

OUT_B = PROJECT_ROOT / "assets/data/csv/LST_zonal_explorer_barrios.json"

YEAR_RE = re.compile(r"_(\d{4})\.geojson$")

# Coherente con ``GENIUS_MONTHLY_CSV_SENTINEL`` / CSV GEE (-9999 = ausencia).
_LST_CSV_ABS_SENTINEL = 9999.0


def _load_json(path: Path) -> dict | None:
    if not path.is_file():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except (OSError, json.JSONDecodeError):
        return None


def _parse_float(v) -> float | None:
    if v is None or v == "":
        return None
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    if not __import__("math").isfinite(x):
        return None
    if abs(x + _LST_CSV_ABS_SENTINEL) < 0.501:
        return None
    return x


def _ingest_yearly_geojson(
    stem_dir: Path,
    stem_prefix: str,
    id_key: str,
) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = defaultdict(list)
    if not stem_dir.is_dir():
        return out
    for p in sorted(stem_dir.glob(f"{stem_prefix}_*.geojson")):
        m = YEAR_RE.search(p.name)
        if not m:
            continue
        year = int(m.group(1))
        gj = _load_json(p)
        if not gj or not isinstance(gj.get("features"), list):
            continue
        for feat in gj["features"]:
            props = feat.get("properties") or {}
            raw_id = props.get(id_key)
            if raw_id is None:
                continue
            eid = str(raw_id).strip()
            if not eid:
                continue
            lst = _parse_float(props.get("LST_mean"))
            if lst is None:
                continue
            out[eid].append({"Year": year, "LST_mean": lst})
    for eid in out:
        out[eid].sort(key=lambda r: r["Year"])
    return dict(out)


def _ingest_monthly_geojson_medians(
    stem_dir: Path,
    stem_prefix: str,
    id_key: str,
) -> dict[str, list[float | None]]:
    acc: dict[str, list[float | None]] = defaultdict(lambda: [None] * 12)
    if not stem_dir.is_dir():
        return {}
    for month in range(1, 13):
        mm = f"{month:02d}"
        p = stem_dir / f"{stem_prefix}_{mm}.geojson"
        gj = _load_json(p)
        if not gj or not isinstance(gj.get("features"), list):
            continue
        for feat in gj["features"]:
            props = feat.get("properties") or {}
            raw_id = props.get(id_key)
            if raw_id is None:
                continue
            eid = str(raw_id).strip()
            if not eid:
                continue
            lst = _parse_float(props.get("LST_mean"))
            acc[eid][month - 1] = lst
    return dict(acc)


def _load_zonal_monthly_csv(path: Path, id_key: str) -> dict[str, dict[int, dict]]:
    if not path.is_file():
        return {}
    out: dict[str, dict[int, dict]] = defaultdict(dict)
    try:
        with path.open(encoding="utf-8", errors="replace", newline="") as f:
            rdr = csv.DictReader(f)
            for row in rdr:
                raw_id = row.get(id_key)
                if raw_id is None:
                    continue
                eid = str(raw_id).strip()
                if not eid:
                    continue
                try:
                    mo = int(round(float(row.get("Month") or 0)))
                except (TypeError, ValueError):
                    continue
                if mo < 1 or mo > 12:
                    continue
                out[eid][mo] = {
                    "LST_mean": (row.get("LST_mean") or "").strip(),
                    "LST_p25": (row.get("LST_p25") or "").strip(),
                    "LST_p75": (row.get("LST_p75") or "").strip(),
                    "anio_actual": (row.get("anio_actual") or "").strip(),
                }
    except OSError:
        return {}
    return dict(out)


def _load_zonal_yearly_csv(path: Path, id_key: str) -> dict[str, dict[int, dict]]:
    if not path.is_file():
        return {}
    out: dict[str, dict[int, dict]] = defaultdict(dict)
    try:
        with path.open(encoding="utf-8", errors="replace", newline="") as f:
            rdr = csv.DictReader(f)
            for row in rdr:
                raw_id = row.get(id_key)
                if raw_id is None:
                    continue
                eid = str(raw_id).strip()
                if not eid:
                    continue
                try:
                    yr = int(round(float(row.get("Year") or 0)))
                except (TypeError, ValueError):
                    continue
                out[eid][yr] = {
                    "LST_mean": (row.get("LST_mean") or "").strip(),
                    "LST_p25": (row.get("LST_p25") or "").strip(),
                    "LST_p75": (row.get("LST_p75") or "").strip(),
                }
    except OSError:
        return {}
    return dict(out)


def _merge_annual_geo_with_y_csv(
    geo_rows: list[dict],
    csv_by_year: dict[int, dict],
) -> list[dict]:
    by_g = {int(r["Year"]): r for r in geo_rows}
    all_years = sorted(
        set(by_g.keys()) | set(csv_by_year.keys()) | set(LST_NULL_SERIES_YEARS)
    )
    merged: list[dict] = []
    for y in all_years:
        if y in LST_NULL_SERIES_YEARS:
            merged.append({"Year": y, "LST_mean": "", "LST_p25": "", "LST_p75": ""})
            continue
        g = by_g.get(y)
        c = csv_by_year.get(y)
        lst = None
        if c:
            lst = _parse_float(c.get("LST_mean"))
        if lst is None and g:
            lst = _parse_float(g.get("LST_mean"))
        if lst is None:
            continue
        row: dict = {"Year": y, "LST_mean": lst}
        if c:
            p25 = (c.get("LST_p25") or "").strip()
            p75 = (c.get("LST_p75") or "").strip()
            if p25:
                row["LST_p25"] = p25
            if p75:
                row["LST_p75"] = p75
        merged.append(row)
    return merged


def _build_entities(
    *,
    id_key: str,
    annual_by_id: dict[str, list[dict]],
    geo_monthly: dict[str, list[float | None]],
    csv_monthly: dict[str, dict[int, dict]],
    csv_yearly: dict[str, dict[int, dict]],
) -> dict[str, dict]:
    all_ids = (
        set(annual_by_id.keys())
        | set(geo_monthly.keys())
        | set(csv_monthly.keys())
        | set(csv_yearly.keys())
    )
    entities: dict[str, dict] = {}
    for eid in sorted(all_ids):
        geo_ann = annual_by_id.get(eid, [])
        cy = csv_yearly.get(eid, {})
        annual = _merge_annual_geo_with_y_csv(geo_ann, cy)
        gm = geo_monthly.get(eid, [None] * 12)
        cm = csv_monthly.get(eid, {})
        monthly = []
        for m in range(1, 13):
            row_csv = cm.get(m)
            lst_g = gm[m - 1]
            if row_csv:
                monthly.append(
                    {
                        "Month": m,
                        "LST_mean": row_csv.get("LST_mean")
                        or (
                            ""
                            if lst_g is None
                            else f"{lst_g:.6f}".rstrip("0").rstrip(".")
                        ),
                        "LST_p25": row_csv.get("LST_p25") or "",
                        "LST_p75": row_csv.get("LST_p75") or "",
                        "anio_actual": row_csv.get("anio_actual") or "",
                    }
                )
            else:
                monthly.append(
                    {
                        "Month": m,
                        "LST_mean": "" if lst_g is None else str(lst_g),
                        "LST_p25": "",
                        "LST_p75": "",
                        "anio_actual": "",
                    }
                )
        entities[eid] = {"annual": annual, "monthly": monthly}
    return entities


def main() -> int:
    print("LST zonal explorer bundle (solo barrios)")
    annual = _ingest_yearly_geojson(
        DIR_YEARLY_B,
        "LST_Yearly_ZonalStats_Barrios",
        "NOMBRE",
    )
    geo_m = _ingest_monthly_geojson_medians(
        DIR_MONTHLY_B,
        "LST_Monthly_ZonalStats_Barrios",
        "NOMBRE",
    )
    csv_m = _load_zonal_monthly_csv(CSV_M_ZONAL_B, "NOMBRE")
    csv_y = _load_zonal_yearly_csv(CSV_Y_ZONAL_B, "NOMBRE")

    entities = _build_entities(
        id_key="NOMBRE",
        annual_by_id=annual,
        geo_monthly=geo_m,
        csv_monthly=csv_m,
        csv_yearly=csv_y,
    )
    payload = {
        "version": 1,
        "idKey": "NOMBRE",
        "entities": entities,
    }
    OUT_B.parent.mkdir(parents=True, exist_ok=True)
    OUT_B.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    nb = len(entities)
    print(f"  barrios: {nb} entidades → {OUT_B.relative_to(PROJECT_ROOT)}")
    if nb == 0:
        print(
            "  Aviso: sin entidades (¿faltan GeoJSON en assets?). "
            "Se escribió JSON vacío o parcial.",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
