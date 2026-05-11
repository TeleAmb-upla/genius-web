#!/usr/bin/env python3
"""
JSON por barrio para el modal «Explorar series» (AOD, NO₂, SO₂) — misma idea que NDVI/LST.

Fuentes: GeoJSON anuales/mensuales zonal barrios + CSV GEE opcionales (*_m_zonal_barrios,
*_y_zonal_barrios).

Si los CSV/bundle no traen columnas P25/P75 (GEE sin export de cuantiles), se rellenan desde los
CSV año–mes **urbanos** (*_YearMonth_urban.csv): intra-anual por año en la serie anual,
inter-anual por mes calendario en la climatología mensual (coherente con el frontend).

Salidas:
  assets/data/csv/AOD_zonal_explorer_barrios.json
  assets/data/csv/NO2_zonal_explorer_barrios.json
  assets/data/csv/SO2_zonal_explorer_barrios.json

Uso (raíz del repo):

  python scripts/repo/bundles/build_atm_zonal_explorer_bundle.py
"""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from dataclasses import dataclass
import math
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[3]

YEAR_RE = re.compile(r"_(\d{4})\.geojson$")


@dataclass(frozen=True)
class AtmZonalProduct:
    key: str
    dir_yearly: Path
    stem_yearly: str
    dir_monthly: Path
    stem_monthly: str
    geo_prop: str
    csv_m: Path
    csv_y: Path
    median_col: str
    p25_col: str
    p75_col: str
    out_json: Path


def _products() -> list[AtmZonalProduct]:
    gj = PROJECT_ROOT / "assets/data/geojson"
    csv = PROJECT_ROOT / "assets/data/csv"
    return [
        AtmZonalProduct(
            key="AOD",
            dir_yearly=gj / "AOD/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Barrios",
            stem_yearly="AOD_Yearly_ZonalStats_Barrios",
            dir_monthly=gj / "AOD/AOD_Monthly_ZonalStats/AOD_Monthly_ZonalStats_Barrios",
            stem_monthly="AOD_Monthly_ZonalStats_Barrios",
            geo_prop="AOD_median",
            csv_m=csv / "AOD_m_zonal_barrios.csv",
            csv_y=csv / "AOD_y_zonal_barrios.csv",
            median_col="AOD_median",
            p25_col="AOD_p25",
            p75_col="AOD_p75",
            out_json=csv / "AOD_zonal_explorer_barrios.json",
        ),
        AtmZonalProduct(
            key="NO2",
            dir_yearly=gj / "NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Barrios",
            stem_yearly="NO2_Yearly_ZonalStats_Barrios",
            dir_monthly=gj / "NO2/NO2_Monthly_ZonalStats/NO2_Monthly_ZonalStats_Barrios",
            stem_monthly="NO2_Monthly_ZonalStats_Barrios",
            geo_prop="NO2_median",
            csv_m=csv / "NO2_m_zonal_barrios.csv",
            csv_y=csv / "NO2_y_zonal_barrios.csv",
            median_col="NO2_median",
            p25_col="NO2_p25",
            p75_col="NO2_p75",
            out_json=csv / "NO2_zonal_explorer_barrios.json",
        ),
        AtmZonalProduct(
            key="SO2",
            dir_yearly=gj / "SO2/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Barrios",
            stem_yearly="SO2_Yearly_ZonalStats_Barrios",
            dir_monthly=gj / "SO2/SO2_Monthly_ZonalStats/SO2_Monthly_ZonalStats_Barrios",
            stem_monthly="SO2_Monthly_ZonalStats_Barrios",
            geo_prop="SO2",
            csv_m=csv / "SO2_m_zonal_barrios.csv",
            csv_y=csv / "SO2_y_zonal_barrios.csv",
            median_col="SO2",
            p25_col="SO2_p25",
            p75_col="SO2_p75",
            out_json=csv / "SO2_zonal_explorer_barrios.json",
        ),
    ]


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
    if not math.isfinite(x):
        return None
    return x


def _filter_aod_year_month_region(v: float | None) -> float | None:
    """Espejo de ``geniusFilterAodYearMonthValue`` en ``assets/js/chart_annual_pctl_band.js``."""
    if v is None or not math.isfinite(v):
        return None
    x = float(v)
    if -0.05 <= x <= 6:
        return x
    if x < 0:
        a = abs(x)
        if a >= 500:
            return min(6.0, a / 1000.0)
        if a >= 100:
            return min(6.0, a / 1000.0)
        return min(6.0, a / 100.0)
    if 6 < x <= 150:
        return min(6.0, x / 100.0)
    if x > 150:
        return min(6.0, x / 1000.0)
    return None


def _filter_so2_umol_display(v: float | None) -> float | None:
    """Espejo de ``so2UmolForDisplay`` (mol/m² → µmol/m² si |v| < 1)."""
    if v is None or not math.isfinite(v):
        return None
    x = float(v)
    return x * 1e6 if abs(x) < 1 else x


def _quantile_linear(sorted_vals: list[float], q: float) -> float | None:
    if not sorted_vals:
        return None
    n = len(sorted_vals)
    if n == 1:
        return sorted_vals[0]
    pos = q * (n - 1)
    lo = int(math.floor(pos))
    hi = int(math.ceil(pos))
    lo = max(0, min(lo, n - 1))
    hi = max(0, min(hi, n - 1))
    return sorted_vals[lo] + (pos - lo) * (sorted_vals[hi] - sorted_vals[lo])


def _q25_q75(vals: list[float]) -> tuple[float | None, float | None]:
    if not vals:
        return None, None
    s = sorted(vals)
    return _quantile_linear(s, 0.25), _quantile_linear(s, 0.75)


def _fmt_csv_num(x: float | None) -> str:
    if x is None or not math.isfinite(x):
        return ""
    return f"{x:.6f}".rstrip("0").rstrip(".")


def _urban_year_month_paths(spec: AtmZonalProduct) -> tuple[Path, str, str | None] | None:
    """CSV año–mes urbano (repo), columna valor, filtro: ``aod`` | ``so2`` | ``None``."""
    csv_dir = PROJECT_ROOT / "assets/data/csv"
    if spec.key == "AOD":
        return csv_dir / "AOD_YearMonth_urban.csv", spec.median_col, "aod"
    if spec.key == "NO2":
        return csv_dir / "NO2_YearMonth_urban.csv", spec.median_col, None
    if spec.key == "SO2":
        return csv_dir / "SO2_YearMonth_urban.csv", spec.median_col, "so2"
    return None


def _ingest_year_month_for_pctiles(
    path: Path,
    value_col: str,
    filt: str | None,
) -> tuple[dict[int, list[float]], dict[int, list[float]]]:
    """
    by_year[y] = todos los valores mensuales válidos de ese año calendario;
    by_calendar_month[m] = valores de ese mes (1–12) en todos los años.
    """
    by_year: dict[int, list[float]] = defaultdict(list)
    by_cal_m: dict[int, list[float]] = defaultdict(list)
    if not path.is_file():
        return dict(by_year), dict(by_cal_m)
    try:
        import csv

        with path.open(encoding="utf-8", errors="replace", newline="") as f:
            rdr = csv.DictReader(f)
            for row in rdr:
                try:
                    y = int(round(float(row.get("Year") or 0)))
                    mo = int(round(float(row.get("Month") or 0)))
                except (TypeError, ValueError):
                    continue
                if y < 1900 or mo < 1 or mo > 12:
                    continue
                raw = _parse_float(row.get(value_col))
                if raw is None:
                    continue
                if filt == "aod":
                    v = _filter_aod_year_month_region(raw)
                elif filt == "so2":
                    v = _filter_so2_umol_display(raw)
                else:
                    v = raw
                if v is None or not math.isfinite(v):
                    continue
                by_year[y].append(v)
                by_cal_m[mo].append(v)
    except OSError:
        return dict(by_year), dict(by_cal_m)
    return dict(by_year), dict(by_cal_m)


def _pct_pair_present(row: dict, p25c: str, p75c: str) -> bool:
    p25 = row.get(p25c)
    p75 = row.get(p75c)
    s25 = (p25 if isinstance(p25, str) else str(p25 or "")).strip()
    s75 = (p75 if isinstance(p75, str) else str(p75 or "")).strip()
    if not s25 or not s75:
        return False
    a = _parse_float(s25)
    b = _parse_float(s75)
    return a is not None and b is not None


def _fill_entities_pctiles_from_urban_ym(
    spec: AtmZonalProduct,
    entities: dict[str, dict],
) -> dict[str, dict]:
    reg = _urban_year_month_paths(spec)
    if reg is None:
        return entities
    path, value_col, filt = reg
    by_year, by_cal_m = _ingest_year_month_for_pctiles(path, value_col, filt)
    if not by_year and not by_cal_m:
        print(
            f"    Aviso [{spec.key}]: sin datos en {path.name} para P25/P75 de respaldo.",
            file=sys.stderr,
        )
        return entities
    p25c, p75c = spec.p25_col, spec.p75_col
    intra_by_year = {y: _q25_q75(vs) for y, vs in by_year.items()}
    inter_by_m = {m: _q25_q75(vs) for m, vs in by_cal_m.items()}

    for _eid, payload in entities.items():
        annual = payload.get("annual") or []
        for row in annual:
            if not isinstance(row, dict):
                continue
            y = row.get("Year")
            try:
                yi = int(y) if y is not None else 0
            except (TypeError, ValueError):
                yi = 0
            if _pct_pair_present(row, p25c, p75c):
                continue
            q = intra_by_year.get(yi)
            if q and q[0] is not None and q[1] is not None:
                row[p25c] = _fmt_csv_num(q[0])
                row[p75c] = _fmt_csv_num(q[1])
                vs_med = by_year.get(yi)
                if vs_med:
                    med_q = _quantile_linear(sorted(vs_med), 0.5)
                    if med_q is not None and math.isfinite(med_q):
                        row[spec.median_col] = float(med_q)

        monthly = payload.get("monthly") or []
        for row in monthly:
            if not isinstance(row, dict):
                continue
            try:
                mo = int(row.get("Month") or 0)
            except (TypeError, ValueError):
                continue
            if mo < 1 or mo > 12:
                continue
            if _pct_pair_present(row, p25c, p75c):
                continue
            q = inter_by_m.get(mo)
            if q and q[0] is not None and q[1] is not None:
                row[p25c] = _fmt_csv_num(q[0])
                row[p75c] = _fmt_csv_num(q[1])
                vs_cm = by_cal_m.get(mo)
                if vs_cm:
                    med_m = _quantile_linear(sorted(vs_cm), 0.5)
                    if med_m is not None and math.isfinite(med_m):
                        row[spec.median_col] = _fmt_csv_num(med_m)
    return entities


def _ingest_yearly_geojson(
    spec: AtmZonalProduct,
    id_key: str,
) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = defaultdict(list)
    if not spec.dir_yearly.is_dir():
        return out
    for p in sorted(spec.dir_yearly.glob(f"{spec.stem_yearly}_*.geojson")):
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
            val = _parse_float(props.get(spec.geo_prop))
            if val is None:
                continue
            out[eid].append({"Year": year, spec.median_col: val})
    for eid in out:
        out[eid].sort(key=lambda r: r["Year"])
    return dict(out)


def _ingest_monthly_geojson_medians(
    spec: AtmZonalProduct,
    id_key: str,
) -> dict[str, list[float | None]]:
    acc: dict[str, list[float | None]] = defaultdict(lambda: [None] * 12)
    if not spec.dir_monthly.is_dir():
        return {}
    for month in range(1, 13):
        mm = f"{month:02d}"
        p = spec.dir_monthly / f"{spec.stem_monthly}_{mm}.geojson"
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
            acc[eid][month - 1] = _parse_float(props.get(spec.geo_prop))
    return dict(acc)


def _load_zonal_monthly_csv(
    path: Path,
    id_key: str,
    median_col: str,
    p25_col: str,
    p75_col: str,
) -> dict[str, dict[int, dict]]:
    if not path.is_file():
        return {}
    out: dict[str, dict[int, dict]] = defaultdict(dict)
    try:
        with path.open(encoding="utf-8", errors="replace", newline="") as f:
            import csv

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
                    median_col: (row.get(median_col) or "").strip(),
                    p25_col: (row.get(p25_col) or "").strip(),
                    p75_col: (row.get(p75_col) or "").strip(),
                    "anio_actual": (row.get("anio_actual") or "").strip(),
                }
    except OSError:
        return {}
    return dict(out)


def _load_zonal_yearly_csv(
    path: Path,
    id_key: str,
    median_col: str,
    p25_col: str,
    p75_col: str,
) -> dict[str, dict[int, dict]]:
    if not path.is_file():
        return {}
    out: dict[str, dict[int, dict]] = defaultdict(dict)
    try:
        with path.open(encoding="utf-8", errors="replace", newline="") as f:
            import csv

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
                    median_col: (row.get(median_col) or "").strip(),
                    p25_col: (row.get(p25_col) or "").strip(),
                    p75_col: (row.get(p75_col) or "").strip(),
                }
    except OSError:
        return {}
    return dict(out)


def _merge_annual_geo_with_y_csv(
    geo_rows: list[dict],
    csv_by_year: dict[int, dict],
    median_col: str,
    p25_col: str,
    p75_col: str,
) -> list[dict]:
    by_g = {int(r["Year"]): r for r in geo_rows}
    all_years = sorted(set(by_g.keys()) | set(csv_by_year.keys()))
    merged: list[dict] = []
    for y in all_years:
        g = by_g.get(y)
        c = csv_by_year.get(y)
        val = None
        if c:
            val = _parse_float(c.get(median_col))
        if val is None and g:
            val = _parse_float(g.get(median_col))
        if val is None:
            continue
        row: dict = {"Year": y, median_col: val}
        if c:
            p25 = (c.get(p25_col) or "").strip()
            p75 = (c.get(p75_col) or "").strip()
            if p25:
                row[p25_col] = p25
            if p75:
                row[p75_col] = p75
        merged.append(row)
    return merged


def _build_entities(
    *,
    spec: AtmZonalProduct,
    annual_by_id: dict[str, list[dict]],
    geo_monthly: dict[str, list[float | None]],
    csv_monthly: dict[str, dict[int, dict]],
    csv_yearly: dict[str, dict[int, dict]],
) -> dict[str, dict]:
    mc, p25c, p75c = spec.median_col, spec.p25_col, spec.p75_col
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
        annual = _merge_annual_geo_with_y_csv(geo_ann, cy, mc, p25c, p75c)
        gm = geo_monthly.get(eid, [None] * 12)
        cm = csv_monthly.get(eid, {})
        monthly = []
        for m in range(1, 13):
            row_csv = cm.get(m)
            geo_v = gm[m - 1]
            fmt_geo = (
                ""
                if geo_v is None
                else f"{geo_v:.6f}".rstrip("0").rstrip(".")
            )
            if row_csv:
                monthly.append(
                    {
                        "Month": m,
                        mc: row_csv.get(mc) or fmt_geo,
                        p25c: row_csv.get(p25c) or "",
                        p75c: row_csv.get(p75c) or "",
                        "anio_actual": row_csv.get("anio_actual") or "",
                    }
                )
            else:
                monthly.append(
                    {
                        "Month": m,
                        mc: fmt_geo,
                        p25c: "",
                        p75c: "",
                        "anio_actual": "",
                    }
                )
        entities[eid] = {"annual": annual, "monthly": monthly}
    return entities


def _build_one(spec: AtmZonalProduct) -> tuple[int, Path]:
    annual = _ingest_yearly_geojson(spec, "NOMBRE")
    geo_m = _ingest_monthly_geojson_medians(spec, "NOMBRE")
    csv_m = _load_zonal_monthly_csv(
        spec.csv_m,
        "NOMBRE",
        spec.median_col,
        spec.p25_col,
        spec.p75_col,
    )
    csv_y = _load_zonal_yearly_csv(
        spec.csv_y,
        "NOMBRE",
        spec.median_col,
        spec.p25_col,
        spec.p75_col,
    )
    entities = _build_entities(
        spec=spec,
        annual_by_id=annual,
        geo_monthly=geo_m,
        csv_monthly=csv_m,
        csv_yearly=csv_y,
    )
    entities = _fill_entities_pctiles_from_urban_ym(spec, entities)
    payload = {"version": 1, "idKey": "NOMBRE", "product": spec.key, "entities": entities}
    spec.out_json.parent.mkdir(parents=True, exist_ok=True)
    spec.out_json.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return len(entities), spec.out_json


def main() -> int:
    print("ATM zonal explorer bundles (barrios: AOD, NO₂, SO₂)")
    for spec in _products():
        n, outp = _build_one(spec)
        print(f"  [{spec.key}] {n} entidades → {outp.relative_to(PROJECT_ROOT)}")
        if n == 0:
            print(
                f"    Aviso: sin entidades para {spec.key} (¿faltan GeoJSON/CSV?).",
                file=sys.stderr,
            )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
