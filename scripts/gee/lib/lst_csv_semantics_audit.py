"""
Auditoría semántica **solo CSV local** para LST (sin Earth Engine).

El pipeline (`drive_audit.compute_drive_freshness_hints`) importa estas funciones para
decidir si ``LST_y_urban.csv`` debe regenerarse sin tocar el resto de exports LST.
"""
from __future__ import annotations

import csv
import io
import math
from pathlib import Path


def lst_quantile_sorted(sorted_vals: list[float], p: float) -> float:
    """Misma convención que d3.quantileSorted sobre valores ordenados."""
    if not sorted_vals:
        raise ValueError("empty")
    if len(sorted_vals) == 1:
        return sorted_vals[0]
    k = (len(sorted_vals) - 1) * p
    f = math.floor(k)
    c = math.ceil(k)
    if f == c:
        return sorted_vals[int(k)]
    return sorted_vals[f] + (sorted_vals[c] - sorted_vals[f]) * (k - f)


def lst_float_metric(raw: str | None, *, sentinel: float = -9999.0) -> float | None:
    if raw is None:
        return None
    s = str(raw).strip()
    if not s:
        return None
    try:
        v = float(s)
    except (ValueError, OverflowError):
        return None
    if not math.isfinite(v):
        return None
    if abs(v - sentinel) < 0.501:
        return None
    return v


def lst_yearmonth_values_by_year(ym_path: Path) -> dict[int, list[float]]:
    out: dict[int, list[float]] = {}
    if not ym_path.is_file():
        return out
    text = ym_path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        return out
    reader = csv.DictReader(io.StringIO(text))
    for row in reader:
        y_raw = (row.get("Year") or "").strip()
        if not y_raw:
            continue
        try:
            y = int(float(y_raw))
        except (ValueError, OverflowError):
            continue
        v = lst_float_metric(row.get("LST_mean"))
        if v is None:
            continue
        out.setdefault(y, []).append(v)
    return out


def audit_lst_y_urban_semantics_vs_yearmonth(
    yearly_path: Path,
    ym_path: Path,
    *,
    tol_celsius: float = 1.15,
) -> tuple[bool, list[str]]:
    """
    Comprueba que ``LST_y_urban.csv`` sea coherente con ``LST_YearMonth_urban.csv``:
    para cada año con ≥1 mes válido en año–mes, la mediana y cuartiles **mensuales**
    locales deben coincidir (dentro de *tol*) con ``LST_mean`` / ``LST_p25`` / ``LST_p75``
    del CSV anual.

    El export GEE (``lst/linear/csv.py``) usa ``p50`` como ``LST_mean``; valores escritos a
    mano o mezclados desde otras fuentes suelen disparar esta auditoría.
    """
    messages: list[str] = []
    if not yearly_path.is_file():
        return True, []
    if not ym_path.is_file():
        return True, []
    by_y = lst_yearmonth_values_by_year(ym_path)
    if not by_y:
        return True, []

    text = yearly_path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        return False, [f"{yearly_path.name}: archivo vacío."]
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = reader.fieldnames or []
    for col in ("Year", "LST_mean", "LST_p25", "LST_p75"):
        if col not in fieldnames:
            return False, [f"{yearly_path.name}: falta columna '{col}'."]

    bad_years: list[int] = []
    for row in reader:
        raw_y = (row.get("Year") or "").strip()
        if not raw_y:
            continue
        try:
            y = int(float(raw_y))
        except (ValueError, OverflowError):
            continue
        vals = by_y.get(y)
        if not vals:
            continue
        s = sorted(vals)
        ym_med = lst_quantile_sorted(s, 0.5)
        ym_q1 = lst_quantile_sorted(s, 0.25)
        ym_q3 = lst_quantile_sorted(s, 0.75)
        csv_med = lst_float_metric(row.get("LST_mean"))
        csv_p25 = lst_float_metric(row.get("LST_p25"))
        csv_p75 = lst_float_metric(row.get("LST_p75"))
        if csv_med is None or csv_p25 is None or csv_p75 is None:
            bad_years.append(y)
            continue
        if (
            abs(csv_med - ym_med) > tol_celsius
            or abs(csv_p25 - ym_q1) > tol_celsius
            or abs(csv_p75 - ym_q3) > tol_celsius
        ):
            bad_years.append(y)

    if not bad_years:
        return True, []
    sample = ", ".join(str(y) for y in sorted(set(bad_years))[:14])
    tail = ""
    if len(set(bad_years)) > 14:
        tail = " …"
    messages.append(
        f"{yearly_path.name} incoherente con {ym_path.name} para año(s): {sample}{tail} "
        f"(tol ±{tol_celsius:g} °C vs mediana/cuartiles mensuales locales). "
        "Se encolará solo la re-exportación necesaria si el resto de tablas LST está bien."
    )
    return False, messages
