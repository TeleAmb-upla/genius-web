#!/usr/bin/env python3
"""
Construye un JSON centralizado por barrio con toda la información para el modal
«Explorar series» NDVI: serie anual y climatología mensual (mediana, P25, P75,
estado actual / año calendario).

Fuentes (repo local):
- GeoJSON anuales ``NDVI_Yearly_ZonalStats_Barrios_{año}.geojson`` → ``annual[]``
- GeoJSON mensuales ``01``–``12`` → mediana climatológica por mes si no hay CSV zonal
- Opcional: ``assets/data/csv/NDVI_m_zonal_barrios.csv`` (export Earth Engine)
- Opcional: ``assets/data/csv/NDVI_y_zonal_barrios.csv``

Salida:
- ``assets/data/csv/NDVI_zonal_explorer_barrios.json``

Uso (desde la raíz del repo):

    python scripts/repo/bundles/build_ndvi_zonal_explorer_bundle.py
"""
from __future__ import annotations

import csv
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]

DIR_YEARLY_B = PROJECT_ROOT / (
    "assets/data/geojson/NDVI/NDVI_Yearly_ZonalStats/NDVI_Yearly_ZonalStats_Barrios"
)
DIR_MONTHLY_B = PROJECT_ROOT / (
    "assets/data/geojson/NDVI/NDVI_Monthly_ZonalStats/NDVI_Monthly_ZonalStats_Barrios"
)

CSV_M_ZONAL_B = PROJECT_ROOT / "assets/data/csv/NDVI_m_zonal_barrios.csv"

CSV_Y_ZONAL_B = PROJECT_ROOT / "assets/data/csv/NDVI_y_zonal_barrios.csv"

OUT_B = PROJECT_ROOT / "assets/data/csv/NDVI_zonal_explorer_barrios.json"

YEAR_RE = re.compile(r"_(\d{4})\.geojson$")


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
    return x


def _ingest_yearly_geojson(
    stem_dir: Path,
    stem_prefix: str,
    id_key: str,
) -> dict[str, list[dict]]:
    """id_key: NOMBRE → lista {Year, NDVI} por entidad."""
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
            ndvi = _parse_float(props.get("NDVI"))
            if ndvi is None:
                continue
            out[eid].append({"Year": year, "NDVI": ndvi})
    for eid in out:
        out[eid].sort(key=lambda r: r["Year"])
    return dict(out)


def _ingest_monthly_geojson_medians(
    stem_dir: Path,
    stem_prefix: str,
    id_key: str,
) -> dict[str, list[float | None]]:
    """Por entidad, 12 valores NDVI (índice 0 = enero) o None."""
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
            ndvi = _parse_float(props.get("NDVI"))
            acc[eid][month - 1] = ndvi
    return dict(acc)


def _load_zonal_monthly_csv(path: Path, id_key: str) -> dict[str, dict[int, dict]]:
    """eid → mes (1–12) → fila {NDVI, NDVI_p25, NDVI_p75, anio_actual}."""
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
                    "NDVI": (row.get("NDVI") or "").strip(),
                    "NDVI_p25": (row.get("NDVI_p25") or "").strip(),
                    "NDVI_p75": (row.get("NDVI_p75") or "").strip(),
                    "anio_actual": (row.get("anio_actual") or "").strip(),
                }
    except OSError:
        return {}
    return dict(out)


def _load_zonal_yearly_csv(path: Path, id_key: str) -> dict[str, dict[int, dict]]:
    """eid → año → {NDVI, NDVI_p25, NDVI_p75} (strings tal como vienen del CSV)."""
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
                    "NDVI": (row.get("NDVI") or "").strip(),
                    "NDVI_p25": (row.get("NDVI_p25") or "").strip(),
                    "NDVI_p75": (row.get("NDVI_p75") or "").strip(),
                }
    except OSError:
        return {}
    return dict(out)


def _merge_annual_geo_with_y_csv(
    geo_rows: list[dict],
    csv_by_year: dict[int, dict],
) -> list[dict]:
    """Une serie anual GeoJSON con CSV GEE anual zonal (prioriza mediana y percentiles del CSV)."""
    by_g = {int(r["Year"]): r for r in geo_rows}
    all_years = sorted(set(by_g.keys()) | set(csv_by_year.keys()))
    merged: list[dict] = []
    for y in all_years:
        g = by_g.get(y)
        c = csv_by_year.get(y)
        ndvi = None
        if c:
            ndvi = _parse_float(c.get("NDVI"))
        if ndvi is None and g:
            ndvi = _parse_float(g.get("NDVI"))
        if ndvi is None:
            continue
        row: dict = {"Year": y, "NDVI": ndvi}
        if c:
            p25 = (c.get("NDVI_p25") or "").strip()
            p75 = (c.get("NDVI_p75") or "").strip()
            if p25:
                row["NDVI_p25"] = p25
            if p75:
                row["NDVI_p75"] = p75
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
            ndvi_g = gm[m - 1]
            if row_csv:
                monthly.append(
                    {
                        "Month": m,
                        "NDVI": row_csv.get("NDVI") or (
                            "" if ndvi_g is None else f"{ndvi_g:.6f}".rstrip("0").rstrip(".")
                        ),
                        "NDVI_p25": row_csv.get("NDVI_p25") or "",
                        "NDVI_p75": row_csv.get("NDVI_p75") or "",
                        "anio_actual": row_csv.get("anio_actual") or "",
                    }
                )
            else:
                monthly.append(
                    {
                        "Month": m,
                        "NDVI": "" if ndvi_g is None else str(ndvi_g),
                        "NDVI_p25": "",
                        "NDVI_p75": "",
                        "anio_actual": "",
                    }
                )
        entities[eid] = {"annual": annual, "monthly": monthly}
    return entities


def main() -> int:
    print("NDVI zonal explorer bundle (solo barrios)")
    annual = _ingest_yearly_geojson(
        DIR_YEARLY_B,
        "NDVI_Yearly_ZonalStats_Barrios",
        "NOMBRE",
    )
    geo_m = _ingest_monthly_geojson_medians(
        DIR_MONTHLY_B,
        "NDVI_Monthly_ZonalStats_Barrios",
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
