"""
Auditoría de frescura en Google Drive antes de encolar exportaciones EE.

Reglas:
- **Alineación asset / reloj**: el máximo (año, mes) de la ImageCollection año-mes en GEE
  debe alcanzar el **último mes civil cerrado UTC** antes de marcar faltantes **anuales**
  (raster, CSV, GeoJSON anual) u ofrecer espejo completo por validación local de tablas
  anuales. Hasta entonces solo se audita la parte mensual en Drive (mtime vs ese mes).
- **Mensual (rasters climatología, y vía enqueue el CSV/GeoJSON mensual)**: el ``modifiedTime``
  en Drive debe ser del último mes cerrado UTC o posterior; si el asset va rezagado, no se
  fuerza espejo mensual aunque Drive parezca viejo.
- **Anual**: brechas año a año en Drive frente a años disponibles en el asset (cuando el
  asset ya cubre el último mes cerrado).
- **CSV**: validación de contenido local (años presentes, datos no vacíos / NaN).
  Los mensuales con «año actual» en el front deben incluir columna(s) ``anio_actual``
  con valores válidos en todos los meses 1..último_mes_cerrado_UTC para
  ``NDVI_m_urban`` / ``LST_m_urban`` (y al menos una entidad por mes en zonal); si no,
  se fuerza reexport (solo cuando el asset está alineado para la parte anual).
"""
from __future__ import annotations

import csv
import datetime
import io
import json
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..config import paths
from ..lib.lst_csv_semantics_audit import audit_lst_y_urban_semantics_vs_yearmonth
from . import download_drive_to_repo
from ..lib import yearmonth as ym_lib


# ---------------------------------------------------------------------------
# Utilidades de parseo
# ---------------------------------------------------------------------------

def parse_drive_modified_time(iso: str | None) -> datetime.datetime | None:
    if not iso or not isinstance(iso, str):
        return None
    s = iso.replace("Z", "+00:00")
    try:
        return datetime.datetime.fromisoformat(s)
    except ValueError:
        return None


def _norm_exts(exts: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(e.lower() if e.startswith(".") else f".{e.lower()}" for e in exts)


def newest_modified_time_for_prefix(
    files: list[dict],
    name_prefix: str,
    extensions: tuple[str, ...],
) -> datetime.datetime | None:
    """Mayor ``modifiedTime`` entre archivos cuyo nombre empieza por *name_prefix*."""
    exts = _norm_exts(extensions)
    best: datetime.datetime | None = None
    plen = len(name_prefix)
    for f in files:
        n = f.get("name") or ""
        if len(n) < plen or not n.startswith(name_prefix):
            continue
        if not any(n.lower().endswith(e) for e in exts):
            continue
        mt = parse_drive_modified_time(f.get("modifiedTime"))
        if mt is None:
            continue
        if best is None or mt > best:
            best = mt
    return best


def yearly_raster_present_in_drive(
    files: list[dict],
    stem: str,
    extensions: tuple[str, ...],
) -> bool:
    exts = _norm_exts(extensions)
    candidates = {f"{stem.lower()}{e}" for e in exts}
    for f in files:
        n = (f.get("name") or "").lower()
        if n in candidates:
            return True
    return False


def monthly_stale_from_drive_mtime(
    files: list[dict],
    monthly_name_prefix: str,
    extensions: tuple[str, ...],
    *,
    wall_month: tuple[int, int] | None = None,
) -> bool:
    """True cuando la carpeta mensual en Drive parece desactualizada (solo mirror/sync).

    Con *wall_month* = último mes civil cerrado UTC, se considera desactualizado si el
    ``modifiedTime`` más reciente (prefijo mensual) es de un mes **estrictamente anterior**
    a ese año-mes. Sin *wall_month* se mantiene la regla previa (año del mtime vs último
    año civil cerrado).
    """
    newest = newest_modified_time_for_prefix(files, monthly_name_prefix, extensions)
    if newest is None:
        return True
    if wall_month is not None:
        mt_ym = (newest.year, newest.month)
        return ym_lib.ym_strictly_before(mt_ym, wall_month)
    last_cy = ym_lib.last_completed_wall_clock_calendar_year()
    return newest.year < last_cy


# ---------------------------------------------------------------------------
# Yearly gap detection
# ---------------------------------------------------------------------------

def _find_missing_yearly_files(
    files: list[dict],
    stem_prefix: str,
    extensions: tuple[str, ...],
    expected_years: list[int],
) -> list[int]:
    """Return years from *expected_years* that lack a matching file on Drive."""
    exts = _norm_exts(extensions)
    prefix_low = stem_prefix.lower()
    existing: set[int] = set()
    for f in files:
        name = (f.get("name") or "").lower()
        for ext in exts:
            if name.startswith(prefix_low) and name.endswith(ext):
                mid = name[len(prefix_low):-len(ext)]
                if mid.isdigit() and len(mid) == 4:
                    existing.add(int(mid))
    return sorted(y for y in expected_years if y not in existing)


def _find_missing_yearly_geo(
    files_b: list[dict],
    files_m: list[dict],
    stem_prefix_b: str,
    stem_prefix_m: str,
    extensions: tuple[str, ...],
    expected_years: list[int],
) -> list[int]:
    """Years missing in Barrios OR Manzanas GeoJSON folders."""
    miss_b = set(_find_missing_yearly_files(files_b, stem_prefix_b, extensions, expected_years))
    miss_m = set(_find_missing_yearly_files(files_m, stem_prefix_m, extensions, expected_years))
    return sorted(miss_b | miss_m)


# ---------------------------------------------------------------------------
# CSV content validation
# ---------------------------------------------------------------------------

# Mensajes cortos cuando falta un CSV en disco (sync selectiva Drive → repo).
_LOCAL_MISSING_CSV_SYNC_HINTS: dict[str, str] = {
    "LST_y_zonal_barrios.csv": (
        "python3 -m scripts.gee.drive.download_drive_to_repo --only lst_csv_yearly "
        "--only-files LST_y_zonal_barrios.csv"
    ),
    "LST_y_urban.csv": (
        "python3 -m scripts.gee.drive.download_drive_to_repo --only lst_csv_yearly "
        "--only-files LST_y_urban.csv"
    ),
}

_LOCAL_YEARLY_CSV_TARGETS: dict[str, list[tuple[Path, str, list[str]]]] = {
    # (csv_path, year_column, value_columns_to_check)
    "ndvi": [
        (paths.REPO_CSV / "NDVI_y_urban.csv", "Year", ["NDVI"]),
        (
            paths.REPO_CSV / "NDVI_y_zonal_barrios.csv",
            "Year",
            ["NDVI", "NDVI_p25", "NDVI_p75"],
        ),
    ],
    "aod": [
        (
            paths.REPO_CSV_AOD / "AOD_y_urban.csv",
            "Year",
            ["AOD_median", "AOD_p25", "AOD_p75"],
        ),
    ],
    "no2": [
        (
            paths.REPO_CSV_NO2 / "NO2_y_urban.csv",
            "Year",
            ["NO2_median", "NO2_p25", "NO2_p75"],
        ),
    ],
    "so2": [
        (
            paths.REPO_CSV_SO2 / "SO2_y_urban.csv",
            "Year",
            ["SO2", "SO2_p25", "SO2_p75"],
        ),
    ],
    "lst": [
        (
            paths.REPO_CSV_LST / "LST_y_urban.csv",
            "Year",
            ["LST_mean", "LST_p25", "LST_p75"],
        ),
        (
            paths.REPO_CSV_LST / "LST_y_zonal_barrios.csv",
            "Year",
            ["LST_mean", "LST_p25", "LST_p75"],
        ),
    ],
}

# CSV largo (Year, Month, …) para «estado actual» en gráficos mensuales del front.
_LOCAL_YEARMONTH_CSV_PATHS: dict[str, Path] = {
    "aod": paths.REPO_CSV_AOD / "AOD_YearMonth_urban.csv",
    "no2": paths.REPO_CSV_NO2 / "NO2_YearMonth_urban.csv",
    "so2": paths.REPO_CSV_SO2 / "SO2_YearMonth_urban.csv",
    "lst": paths.REPO_CSV_LST / "LST_YearMonth_urban.csv",
}

_LOCAL_YEARMONTH_CSV_COLUMNS: dict[str, tuple[str, ...]] = {
    "aod": ("Year", "Month", "AOD_median"),
    "no2": ("Year", "Month", "NO2_median"),
    "so2": ("Year", "Month", "SO2"),
    "lst": ("Year", "Month", "LST_mean"),
}

_LOCAL_MONTHLY_CSV_TARGETS: dict[str, list[tuple[Path, str, list[int], list[str]]]] = {
    "ndvi": [
        (
            paths.REPO_CSV / "NDVI_m_urban.csv",
            "Month",
            list(range(1, 13)),
            ["NDVI", "NDVI_p25", "NDVI_p75", "anio_actual"],
        ),
        (
            paths.REPO_CSV / "NDVI_m_av.csv",
            "Month",
            list(range(1, 13)),
            [
                "NDVI_Gestion",
                "NDVI_Planificacion",
                "NDVI_Urbano",
                "NDVI_Gestion_anio_actual",
                "NDVI_Planificacion_anio_actual",
                "NDVI_Urbano_anio_actual",
            ],
        ),
        (
            paths.REPO_CSV / "NDVI_m_zonal_barrios.csv",
            "Month",
            list(range(1, 13)),
            ["NDVI", "NDVI_p25", "NDVI_p75", "anio_actual"],
        ),
    ],
    "aod": [
        (
            paths.REPO_CSV_AOD / "AOD_m_urban.csv",
            "Month",
            list(range(1, 13)),
            ["AOD_median", "AOD_p25", "AOD_p75", "anio_actual"],
        ),
    ],
    "no2": [
        (
            paths.REPO_CSV_NO2 / "NO2_m_urban.csv",
            "Month",
            list(range(1, 13)),
            ["NO2_median", "NO2_p25", "NO2_p75", "anio_actual"],
        ),
        (
            paths.REPO_CSV_NO2 / "NO2_m_zonal_barrios.csv",
            "Month",
            list(range(1, 13)),
            ["NO2_median", "NO2_p25", "NO2_p75", "anio_actual"],
        ),
    ],
    "so2": [
        (
            paths.REPO_CSV_SO2 / "SO2_m_urban.csv",
            "Month",
            list(range(1, 13)),
            ["SO2", "SO2_p25", "SO2_p75", "anio_actual"],
        ),
        (
            paths.REPO_CSV_SO2 / "SO2_m_zonal_barrios.csv",
            "Month",
            list(range(1, 13)),
            ["SO2", "SO2_p25", "SO2_p75", "anio_actual"],
        ),
    ],
    "lst": [
        (
            paths.REPO_CSV_LST / "LST_m_urban.csv",
            "Month",
            list(range(1, 13)),
            ["LST_mean", "LST_p25", "LST_p75", "anio_actual"],
        ),
        (
            paths.REPO_CSV_LST / "LST_m_zonal_barrios.csv",
            "Month",
            list(range(1, 13)),
            ["LST_mean", "LST_p25", "LST_p75", "anio_actual"],
        ),
    ],
}

# Claves de SYNC_REGISTRY: espejo completo (full_replace) cuando tablas CSV están
# desfasadas. NDVI usa un solo bundle «csv»; el resto separa mensual vs anual — si solo
# se fuerza la clave anual, el mensual queda en modo incremental y no sobrescribe un
# .csv local antiguo aunque Drive tenga versión con percentiles.
_CSV_TABLE_MIRROR_KEYS: dict[str, frozenset[str]] = {
    "ndvi": frozenset({"csv"}),
    "no2": frozenset({"no2_csv_monthly"}),
    "so2": frozenset({"so2_csv_monthly"}),
    "lst": frozenset({"lst_csv_monthly", "lst_csv_yearly"}),
}


def _is_value_empty_or_nan(val: str) -> bool:
    """True if the string represents a missing / empty / NaN value."""
    v = val.strip()
    if not v:
        return True
    try:
        return math.isnan(float(v))
    except (ValueError, OverflowError):
        return False


def _validate_local_csv(
    csv_path: Path,
    expected_years: list[int],
    year_column: str = "Year",
    value_columns: list[str] | None = None,
) -> tuple[bool, str, int]:
    """
    Returns ``(is_valid, reason, n_missing_years)``.

    Checks:
    1. File exists and is non-empty.
    2. All *expected_years* have at least one row.
    3. If *value_columns* is set: every name exists in the header, and for each
       expected row **every** listed column is non-empty / non-NaN (no basta con
       una sola columna, p. ej. mediana sin P25/P75).
    """
    if not csv_path.is_file():
        msg = f"archivo no existe: {csv_path.name}"
        hint = _LOCAL_MISSING_CSV_SYNC_HINTS.get(csv_path.name)
        if hint:
            msg += f" — {hint}"
        return False, msg, len(expected_years)
    text = csv_path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        return False, f"archivo vacío: {csv_path.name}", len(expected_years)

    try:
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = reader.fieldnames or []
    except Exception as exc:
        return False, f"error leyendo CSV: {exc}", len(expected_years)

    if year_column not in fieldnames:
        return False, f"columna '{year_column}' no encontrada en {csv_path.name}", len(expected_years)

    if value_columns:
        for col in value_columns:
            if col not in fieldnames:
                return (
                    False,
                    f"falta columna requerida '{col}' en {csv_path.name}",
                    len(expected_years),
                )

    check_cols = value_columns or [c for c in fieldnames if c != year_column]
    years_found_valid: set[int] = set()
    unexpected_years: set[int] = set()

    for row in reader:
        raw_year = (row.get(year_column) or "").strip()
        if not raw_year:
            continue
        try:
            yr = int(float(raw_year))
        except (ValueError, OverflowError):
            continue
        if yr not in expected_years:
            unexpected_years.add(yr)
            continue
        has_value = True
        for col in check_cols:
            cell = row.get(col, "")
            if _is_value_empty_or_nan(cell):
                has_value = False
                break
        if has_value:
            years_found_valid.add(yr)

    missing = sorted(set(expected_years) - years_found_valid)
    if missing:
        sample = ", ".join(str(y) for y in missing[:5])
        tail = f" (y {len(missing) - 5} más)" if len(missing) > 5 else ""
        return False, f"años sin datos válidos en {csv_path.name}: {sample}{tail}", len(missing)
    return True, "OK", 0


def _validate_all_local_csvs(
    product: str,
    expected_years: list[int],
) -> tuple[bool, list[str], bool]:
    """Validate all local yearly CSVs for *product*.

    Returns ``(all_valid, reasons, completely_invalid)``.

    *completely_invalid* is ``True`` when **every** (or nearly every)
    expected year has null / empty values — this signals that the GEE
    export itself produced bad data and a Drive re-download alone will
    not help; a fresh GEE re-export is needed.
    """
    specs = _LOCAL_YEARLY_CSV_TARGETS.get(product, [])
    if not specs:
        return True, [], False
    all_ok = True
    completely_invalid = False
    reasons: list[str] = []
    for csv_path, year_col, val_cols in specs:
        ok, reason, n_missing = _validate_local_csv(
            csv_path, expected_years, year_col, val_cols
        )
        if not ok:
            all_ok = False
            reasons.append(reason)
            if expected_years and n_missing >= len(expected_years) * 0.8:
                completely_invalid = True
    return all_ok, reasons, completely_invalid


# Sentinela GEE en CSV de climatología cuando no hay muestras (coherente con mcp / exports).
_CLIM_CSV_PLACEHOLDER_SENTINEL = -9999.0


def _ndvi_anio_actual_cell_valid(raw: str) -> bool:
    """``anio_actual`` distinto de sentinela y en rango NDVI físico [-1, 1]."""
    s = (raw or "").strip()
    if not s:
        return False
    try:
        v = float(s)
    except (TypeError, ValueError, OverflowError):
        return False
    if not math.isfinite(v):
        return False
    if abs(v - _CLIM_CSV_PLACEHOLDER_SENTINEL) < 1e-3:
        return False
    return -1.0 <= v <= 1.0


def _lst_anio_actual_cell_valid(raw: str) -> bool:
    """``anio_actual`` distinto de sentinela y en rango LST superficial (°C, holgado)."""
    s = (raw or "").strip()
    if not s:
        return False
    try:
        v = float(s)
    except (TypeError, ValueError, OverflowError):
        return False
    if not math.isfinite(v):
        return False
    if abs(v - _CLIM_CSV_PLACEHOLDER_SENTINEL) < 1e-3:
        return False
    return -100.0 <= v <= 100.0


def _ndvi_m_urban_anio_covers_wall_months(csv_path: Path) -> tuple[bool, str]:
    """
    ``NDVI_m_urban``: exactamente 12 filas Month=1..12; para cada mes ``m`` en
    ``1 .. último_mes_cerrado_UTC`` se exige ``anio_actual`` válido (datos del año
    ``last_complete_calendar_month`` coherente con ``csv_tasks`` / front).
    """
    if not csv_path.is_file():
        return True, ""
    ly, lm = ym_lib.last_complete_calendar_month_utc()
    try:
        text = csv_path.read_text(encoding="utf-8", errors="replace").strip()
    except OSError as exc:
        return False, f"no se pudo leer {csv_path.name}: {exc}"
    if not text:
        return False, f"archivo vacío: {csv_path.name}"
    try:
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = reader.fieldnames or []
    except Exception as exc:
        return False, f"error leyendo {csv_path.name}: {exc}"
    if "Month" not in fieldnames or "anio_actual" not in fieldnames:
        return True, ""
    by_m: dict[int, str] = {}
    for row in reader:
        raw_m = (row.get("Month") or "").strip()
        if not raw_m:
            continue
        try:
            mo = int(float(raw_m))
        except (TypeError, ValueError, OverflowError):
            continue
        by_m[mo] = (row.get("anio_actual") or "").strip()
    missing_rows: list[int] = []
    bad_vals: list[int] = []
    for m in range(1, lm + 1):
        if m not in by_m:
            missing_rows.append(m)
        elif not _ndvi_anio_actual_cell_valid(by_m[m]):
            bad_vals.append(m)
    if missing_rows:
        return (
            False,
            f"{csv_path.name}: faltan mes(es) {missing_rows} — se espera fila por mes "
            f"1–{lm} con anio_actual del año civil {ly} (último mes cerrado UTC: {ly}-{lm:02d}). "
            "Reexportar ``start_ndvi_m_csv_tasks`` y sincronizar.",
        )
    if bad_vals:
        return (
            False,
            f"{csv_path.name}: anio_actual ausente o sentinela {_CLIM_CSV_PLACEHOLDER_SENTINEL:g} "
            f"en mes(es) {bad_vals} (faltan datos {ly} en asset NDVI año-mes o export viejo). "
            "Reexportar CSV mensual NDVI y sincronizar.",
        )
    return True, ""


def _lst_m_urban_anio_covers_wall_months(csv_path: Path) -> tuple[bool, str]:
    """
    ``LST_m_urban``: una fila por ``Month=1..12``; para cada mes ``m`` en
    ``1 .. último_mes_cerrado_UTC`` se exige ``anio_actual`` válido (LST °C).
    """
    if not csv_path.is_file():
        return True, ""
    ly, lm = ym_lib.last_complete_calendar_month_utc()
    try:
        text = csv_path.read_text(encoding="utf-8", errors="replace").strip()
    except OSError as exc:
        return False, f"no se pudo leer {csv_path.name}: {exc}"
    if not text:
        return False, f"archivo vacío: {csv_path.name}"
    try:
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = reader.fieldnames or []
    except Exception as exc:
        return False, f"error leyendo {csv_path.name}: {exc}"
    if "Month" not in fieldnames or "anio_actual" not in fieldnames:
        return True, ""
    by_m: dict[int, str] = {}
    for row in reader:
        raw_m = (row.get("Month") or "").strip()
        if not raw_m:
            continue
        try:
            mo = int(float(raw_m))
        except (TypeError, ValueError, OverflowError):
            continue
        by_m[mo] = (row.get("anio_actual") or "").strip()
    missing_rows: list[int] = []
    bad_vals: list[int] = []
    for m in range(1, lm + 1):
        if m not in by_m:
            missing_rows.append(m)
        elif not _lst_anio_actual_cell_valid(by_m[m]):
            bad_vals.append(m)
    if missing_rows:
        return (
            False,
            f"{csv_path.name}: faltan mes(es) {missing_rows} — se espera fila por mes "
            f"1–{lm} con anio_actual del año civil {ly} (último mes cerrado UTC: {ly}-{lm:02d}). "
            "Reexportar ``start_lst_csv_tasks`` y sincronizar.",
        )
    if bad_vals:
        return (
            False,
            f"{csv_path.name}: anio_actual ausente o sentinela {_CLIM_CSV_PLACEHOLDER_SENTINEL:g} "
            f"en mes(es) {bad_vals} (faltan datos {ly} en Landsat LST año-mes o export viejo). "
            "Reexportar CSV mensual LST y sincronizar.",
        )
    return True, ""


def _ndvi_zonal_m_anio_covers_wall_months(csv_path: Path) -> tuple[bool, str]:
    """
    Zonal: por cada mes ``1..lm`` debe existir **al menos** una fila (cualquier entidad)
    con ``anio_actual`` válido.
    """
    if not csv_path.is_file():
        return True, ""
    ly, lm = ym_lib.last_complete_calendar_month_utc()
    try:
        text = csv_path.read_text(encoding="utf-8", errors="replace").strip()
    except OSError as exc:
        return False, f"no se pudo leer {csv_path.name}: {exc}"
    if not text:
        return False, f"archivo vacío: {csv_path.name}"
    try:
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = reader.fieldnames or []
    except Exception as exc:
        return False, f"error leyendo {csv_path.name}: {exc}"
    if "Month" not in fieldnames or "anio_actual" not in fieldnames:
        return True, ""
    found: dict[int, bool] = {m: False for m in range(1, lm + 1)}
    for row in reader:
        raw_m = (row.get("Month") or "").strip()
        if not raw_m:
            continue
        try:
            mo = int(float(raw_m))
        except (TypeError, ValueError, OverflowError):
            continue
        if mo < 1 or mo > lm:
            continue
        if _ndvi_anio_actual_cell_valid(row.get("anio_actual") or ""):
            found[mo] = True
    missing = [m for m in range(1, lm + 1) if not found[m]]
    if missing:
        return (
            False,
            f"{csv_path.name}: ningún anio_actual válido para mes(es) {missing} "
            f"(año referencia {ly} hasta mes {lm} UTC). Reexportar NDVI_m_zonal_* y sincronizar.",
        )
    return True, ""


def _lst_zonal_m_anio_covers_wall_months(csv_path: Path) -> tuple[bool, str]:
    """
    Zonal LST: por cada mes ``1..lm`` debe existir **al menos** una fila (cualquier entidad)
    con ``anio_actual`` válido.
    """
    if not csv_path.is_file():
        return True, ""
    ly, lm = ym_lib.last_complete_calendar_month_utc()
    try:
        text = csv_path.read_text(encoding="utf-8", errors="replace").strip()
    except OSError as exc:
        return False, f"no se pudo leer {csv_path.name}: {exc}"
    if not text:
        return False, f"archivo vacío: {csv_path.name}"
    try:
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = reader.fieldnames or []
    except Exception as exc:
        return False, f"error leyendo {csv_path.name}: {exc}"
    if "Month" not in fieldnames or "anio_actual" not in fieldnames:
        return True, ""
    found: dict[int, bool] = {m: False for m in range(1, lm + 1)}
    for row in reader:
        raw_m = (row.get("Month") or "").strip()
        if not raw_m:
            continue
        try:
            mo = int(float(raw_m))
        except (TypeError, ValueError, OverflowError):
            continue
        if mo < 1 or mo > lm:
            continue
        if _lst_anio_actual_cell_valid(row.get("anio_actual") or ""):
            found[mo] = True
    missing = [m for m in range(1, lm + 1) if not found[m]]
    if missing:
        return (
            False,
            f"{csv_path.name}: ningún anio_actual válido para mes(es) {missing} "
            f"(año referencia {ly} hasta mes {lm} UTC). Reexportar LST_m_zonal_* y sincronizar.",
        )
    return True, ""


def _climatology_column_names(val_cols: list[str]) -> list[str]:
    """Solo columnas de climatología (P25/P50/P75), sin ``anio_actual`` ni ``*_anio_actual``."""
    return [
        c
        for c in val_cols
        if c != "anio_actual" and not str(c).endswith("_anio_actual")
    ]


def _monthly_climatology_not_all_placeholder_sentinel(
    csv_path: Path,
    time_col: str,
    expected_values: list[int],
    clim_cols: list[str],
    *,
    sentinel: float = _CLIM_CSV_PLACEHOLDER_SENTINEL,
) -> tuple[bool, str]:
    """
    Rechaza CSV donde toda la climatología es el sentinela (export roto o plantilla).
    """
    if not clim_cols:
        return True, ""
    text = csv_path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        return False, f"archivo vacío: {csv_path.name}"
    try:
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = reader.fieldnames or []
    except Exception as exc:
        return False, f"error leyendo CSV: {exc}"
    if time_col not in fieldnames:
        return True, ""
    expected_set = set(expected_values)
    any_non_sentinel = False
    for row in reader:
        raw_t = (row.get(time_col) or "").strip()
        if not raw_t:
            continue
        try:
            t = int(float(raw_t))
        except (ValueError, OverflowError):
            continue
        if t not in expected_set:
            continue
        for col in clim_cols:
            if col not in fieldnames:
                continue
            cell = (row.get(col, "") or "").strip()
            try:
                v = float(cell)
            except (ValueError, OverflowError):
                any_non_sentinel = True
                break
            if math.isfinite(v) and abs(v - sentinel) > 1e-3:
                any_non_sentinel = True
                break
        if any_non_sentinel:
            break
    if not any_non_sentinel:
        return (
            False,
            f"climatología solo sentinela ({sentinel:g}) en {csv_path.name} — "
            "reexportar CSV mensual desde GEE o restaurar desde Drive",
        )
    return True, ""


def _triplet_max_spread(med_s: str, p25_s: str, p75_s: str) -> float | None:
    """Máx. |med-p25|, |med-p75|, |p25-p75|; None si no son números finitos."""
    try:
        m = float(med_s)
        a = float(p25_s)
        b = float(p75_s)
    except (TypeError, ValueError, OverflowError):
        return None
    if not all(math.isfinite(x) for x in (m, a, b)):
        return None
    return max(abs(m - a), abs(m - b), abs(a - b))


def _monthly_percentile_triplets_nondegenerate(
    csv_path: Path,
    time_col: str,
    expected_values: list[int],
    value_columns: list[str],
    *,
    min_spread: float = 1e-5,
) -> tuple[bool, str]:
    """
    Tras pasar cabecera y celdas no vacías, rechaza CSV rellenado copiando la mediana
    en p25/p75 (placeholder) para todas las filas de cada trío (mediana, p25, p75).
    """
    if not value_columns:
        return True, ""
    if not any(
        str(c).endswith("_p25") or str(c).endswith("_p75") for c in value_columns
    ):
        return True, ""
    if len(value_columns) % 3 != 0:
        return True, ""
    triplets = [
        (value_columns[i], value_columns[i + 1], value_columns[i + 2])
        for i in range(0, len(value_columns), 3)
    ]
    text = csv_path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        return False, f"archivo vacío: {csv_path.name}"
    try:
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = reader.fieldnames or []
    except Exception as exc:
        return False, f"error leyendo CSV: {exc}"

    if time_col not in fieldnames:
        return True, ""

    expected_set = set(expected_values)
    rows: list[dict[str, str]] = []
    for row in reader:
        raw_t = (row.get(time_col) or "").strip()
        if not raw_t:
            continue
        try:
            t = int(float(raw_t))
        except (ValueError, OverflowError):
            continue
        if t in expected_set:
            rows.append(row)

    for med_c, p25_c, p75_c in triplets:
        if med_c not in fieldnames or p25_c not in fieldnames or p75_c not in fieldnames:
            continue
        saw_spread = False
        for row in rows:
            spread = _triplet_max_spread(
                row.get(med_c, ""),
                row.get(p25_c, ""),
                row.get(p75_c, ""),
            )
            if spread is not None and spread > min_spread:
                saw_spread = True
                break
        if rows and not saw_spread:
            return (
                False,
                f"percentiles degenerados (p25≈p75≈{med_c}) en {csv_path.name} — "
                "posible placeholder; reexportar o descargar desde Drive",
            )
    return True, ""


def _validate_all_local_monthly_csvs(
    product: str,
) -> tuple[bool, list[str], list[Path]]:
    specs = _LOCAL_MONTHLY_CSV_TARGETS.get(product, [])
    if not specs:
        return True, [], []
    all_ok = True
    reasons: list[str] = []
    invalid_paths: list[Path] = []
    for csv_path, time_col, expected_values, val_cols in specs:
        ok, reason, _n_missing = _validate_local_csv(
            csv_path, expected_values, time_col, val_cols
        )
        if not ok:
            all_ok = False
            reasons.append(reason)
            invalid_paths.append(csv_path)
            continue
        clim_cols = _climatology_column_names(val_cols)
        ok2, reason2 = _monthly_percentile_triplets_nondegenerate(
            csv_path, time_col, expected_values, clim_cols
        )
        if not ok2:
            all_ok = False
            reasons.append(reason2)
            invalid_paths.append(csv_path)
            continue
        ok3, reason3 = _monthly_climatology_not_all_placeholder_sentinel(
            csv_path, time_col, expected_values, clim_cols
        )
        if not ok3:
            all_ok = False
            reasons.append(reason3)
            invalid_paths.append(csv_path)
            continue
        if product == "ndvi" and csv_path.name == "NDVI_m_urban.csv":
            ok4, reason4 = _ndvi_m_urban_anio_covers_wall_months(csv_path)
            if not ok4:
                all_ok = False
                reasons.append(reason4)
                invalid_paths.append(csv_path)
        elif product == "ndvi" and csv_path.name == "NDVI_m_zonal_barrios.csv":
            ok4, reason4 = _ndvi_zonal_m_anio_covers_wall_months(csv_path)
            if not ok4:
                all_ok = False
                reasons.append(reason4)
                invalid_paths.append(csv_path)
        elif product == "lst" and csv_path.name == "LST_m_urban.csv":
            ok4, reason4 = _lst_m_urban_anio_covers_wall_months(csv_path)
            if not ok4:
                all_ok = False
                reasons.append(reason4)
                invalid_paths.append(csv_path)
        elif product == "lst" and csv_path.name == "LST_m_zonal_barrios.csv":
            ok4, reason4 = _lst_zonal_m_anio_covers_wall_months(csv_path)
            if not ok4:
                all_ok = False
                reasons.append(reason4)
                invalid_paths.append(csv_path)
    if product == "ndvi" and not all_ok:
        _u_path = paths.REPO_CSV / "NDVI_m_urban.csv"
        _zb = paths.REPO_CSV / "NDVI_m_zonal_barrios.csv"
        if _u_path.is_file() and _zb.is_file():
            _u_ok, _ = _ndvi_m_urban_anio_covers_wall_months(_u_path)
            _b_ok, _ = _ndvi_zonal_m_anio_covers_wall_months(_zb)
            if not _u_ok and _b_ok:
                reasons.append(
                    "NDVI: ``NDVI_m_zonal_barrios`` tiene "
                    "``anio_actual`` válido para el muro UTC pero ``NDVI_m_urban`` no — "
                    "suele ser CSV urbano viejo en disco o sync parcial; reexportar el "
                    "lote mensual (``start_ndvi_m_csv_tasks``) y sincronizar."
                )
    if product == "lst" and not all_ok:
        _u_path = paths.REPO_CSV_LST / "LST_m_urban.csv"
        _zb = paths.REPO_CSV_LST / "LST_m_zonal_barrios.csv"
        if _u_path.is_file() and _zb.is_file():
            _u_ok, _ = _lst_m_urban_anio_covers_wall_months(_u_path)
            _b_ok, _ = _lst_zonal_m_anio_covers_wall_months(_zb)
            if not _u_ok and _b_ok:
                reasons.append(
                    "LST: ``LST_m_zonal_barrios`` tiene "
                    "``anio_actual`` válido para el muro UTC pero ``LST_m_urban`` no — "
                    "suele ser CSV urbano viejo en disco o sync parcial; reexportar "
                    "``start_lst_csv_tasks`` y sincronizar."
                )

    return all_ok, reasons, invalid_paths


def validate_local_monthly_csvs(
    product: str,
) -> tuple[bool, list[str], list[Path]]:
    """Valida CSV mensuales del repo (sin API Drive). Usado por el pipeline / enqueue."""
    return _validate_all_local_monthly_csvs(product)


def _validate_local_yearmonth_csvs(
    product: str,
) -> tuple[bool, list[str], list[Path]]:
    """
    Comprueba que exista el CSV año–mes esperado en local y que tenga cabecera + ≥1 fila
    con las columnas mínimas (estado actual en el front).
    """
    csv_path = _LOCAL_YEARMONTH_CSV_PATHS.get(product)
    if csv_path is None:
        return True, [], []
    cols = _LOCAL_YEARMONTH_CSV_COLUMNS.get(product, ())
    if not cols:
        return True, [], []
    if not csv_path.is_file():
        return False, [f"CSV año-mes no existe: {csv_path.name}"], []
    text = csv_path.read_text(encoding="utf-8", errors="replace").strip()
    if not text:
        return False, [f"CSV año-mes vacío: {csv_path.name}"], [csv_path]
    try:
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = reader.fieldnames or []
    except Exception as exc:
        return False, [f"error leyendo {csv_path.name}: {exc}"], [csv_path]
    for c in cols:
        if c not in fieldnames:
            return (
                False,
                [f"falta columna '{c}' en {csv_path.name}"],
                [csv_path],
            )
    cy = datetime.datetime.utcnow().year
    value_col = cols[-1]
    any_data = False
    has_current_year = False
    for row in reader:
        if any((row.get(c) or "").strip() for c in cols):
            any_data = True
        y_raw = (row.get("Year") or "").strip()
        if not y_raw:
            continue
        try:
            yr = int(float(y_raw))
        except (ValueError, OverflowError):
            continue
        if yr == cy:
            cell = row.get(value_col, "")
            if not _is_value_empty_or_nan(cell):
                has_current_year = True
    if not any_data:
        return False, [f"sin filas con datos en {csv_path.name}"], [csv_path]
    if not has_current_year:
        return (
            False,
            [
                f"CSV año-mes sin fila válida para el año calendario actual ({cy}) en "
                f"{csv_path.name} — reexportar desde GEE."
            ],
            [csv_path],
        )
    return True, [], []


# ---------------------------------------------------------------------------
# GeoJSON content validation
# ---------------------------------------------------------------------------

_LOCAL_YEARLY_GEO_TARGETS: dict[str, dict[str, tuple[Path, str, str]]] = {
    # zone -> (directory, filename_prefix, value_property)
    "ndvi": {
        "barrios":  (paths.REPO_GEOJSON_NDVI_YEARLY_B, "NDVI_Yearly_ZonalStats_Barrios_", "NDVI"),
        "manzanas": (paths.REPO_GEOJSON_NDVI_YEARLY_M, "NDVI_Yearly_ZonalStats_Manzanas_", "NDVI"),
    },
    "aod": {
        "barrios":  (paths.REPO_GEOJSON_AOD_YEARLY_B, "AOD_Yearly_ZonalStats_Barrios_", "AOD_median"),
        "manzanas": (paths.REPO_GEOJSON_AOD_YEARLY_M, "AOD_Yearly_ZonalStats_Manzanas_", "AOD_median"),
    },
    "no2": {
        "barrios":  (paths.REPO_GEOJSON_NO2_YEARLY_B, "NO2_Yearly_ZonalStats_Barrios_", "NO2_median"),
        "manzanas": (paths.REPO_GEOJSON_NO2_YEARLY_M, "NO2_Yearly_ZonalStats_Manzanas_", "NO2_median"),
    },
    "so2": {
        "barrios":  (paths.REPO_GEOJSON_SO2_YEARLY_B, "SO2_Yearly_ZonalStats_Barrios_", "SO2"),
        "manzanas": (paths.REPO_GEOJSON_SO2_YEARLY_M, "SO2_Yearly_ZonalStats_Manzanas_", "SO2"),
    },
    "lst": {
        "barrios":  (paths.REPO_GEOJSON_LST_YEARLY_B, "LST_Yearly_ZonalStats_Barrios_", "LST_mean"),
        "manzanas": (paths.REPO_GEOJSON_LST_YEARLY_M, "LST_Yearly_ZonalStats_Manzanas_", "LST_mean"),
    },
}


def _geojson_zone_value_status(geojson_path: Path, value_property: str) -> str:
    """
    Return ``missing`` | ``ok`` | ``all_null`` | ``bad`` for one zonal GeoJSON file.
    """
    if not geojson_path.is_file():
        return "missing"
    try:
        text = geojson_path.read_text(encoding="utf-8", errors="replace")
        data = json.loads(text)
    except Exception:
        return "bad"
    features = data.get("features") or []
    if not features:
        return "bad"
    for feat in features:
        props = feat.get("properties") or {}
        val = props.get(value_property)
        if val is None:
            continue
        try:
            if not math.isnan(float(val)):
                return "ok"
        except (ValueError, TypeError):
            return "ok"
    return "all_null"


def _local_yearly_geo_all_null_years_for_product(
    product: str, expected_years: list[int]
) -> list[int]:
    """
    Years where **every** local yearly zonal file exists but all features are null
    in the value column (bad GEE export / stale Drive). Not the same as missing files.
    """
    specs = _LOCAL_YEARLY_GEO_TARGETS.get(product, {})
    if not specs:
        return []
    out: list[int] = []
    for year in expected_years:
        statuses: list[str] = []
        for _zone, (directory, prefix, value_prop) in specs.items():
            fpath = directory / f"{prefix}{year}.geojson"
            statuses.append(_geojson_zone_value_status(fpath, value_prop))
        if "missing" in statuses or "bad" in statuses or "ok" in statuses:
            continue
        if statuses and all(s == "all_null" for s in statuses):
            out.append(year)
    return sorted(out)


def _validate_local_geojson(
    geojson_path: Path,
    value_property: str,
) -> tuple[bool, str]:
    """
    Returns ``(is_valid, reason)``.

    A GeoJSON is invalid when it exists but every feature has a null / None
    value in *value_property* (i.e. the export ran but produced no real data).
    """
    if not geojson_path.is_file():
        return False, f"archivo no existe: {geojson_path.name}"
    try:
        text = geojson_path.read_text(encoding="utf-8", errors="replace")
        data = json.loads(text)
    except Exception as exc:
        return False, f"error leyendo GeoJSON: {exc}"

    features = data.get("features") or []
    if not features:
        return False, f"sin features: {geojson_path.name}"

    for feat in features:
        props = feat.get("properties") or {}
        val = props.get(value_property)
        if val is not None:
            try:
                if not math.isnan(float(val)):
                    return True, "OK"
            except (ValueError, TypeError):
                return True, "OK"

    return False, (
        f"todos los valores de '{value_property}' son null en {geojson_path.name}"
    )


def _validate_local_geojsons_for_years(
    product: str,
    expected_years: list[int],
) -> list[int]:
    """
    Return years whose local yearly GeoJSON files are missing or have
    all-null values in the expected property column.
    """
    specs = _LOCAL_YEARLY_GEO_TARGETS.get(product, {})
    if not specs:
        return []
    invalid_years: set[int] = set()
    for year in expected_years:
        for _zone, (directory, prefix, value_prop) in specs.items():
            fname = f"{prefix}{year}.geojson"
            fpath = directory / fname
            ok, _reason = _validate_local_geojson(fpath, value_prop)
            if not ok:
                invalid_years.add(year)
                break
    return sorted(invalid_years)


# ---------------------------------------------------------------------------
# DriveFreshnessHints
# ---------------------------------------------------------------------------

@dataclass(frozen=True)
class DriveFreshnessHints:
    """Decisiones de pre-flight coherentes con auditoría Drive + GEE asset."""

    force_full_monthly_raster_export: bool = False
    yearly_raster_missing_or_stale: bool = False
    yearly_tables_missing_or_stale: bool = False
    yearly_csv_missing_or_stale: bool = False
    local_csv_stale: bool = False
    clim_csv_local_stale: bool = False
    yearmonth_csv_local_stale: bool = False
    yearly_geo_missing_or_stale: bool = False
    yearly_raster_enqueue_bypass: bool = False
    mirror_full_monthly_local: bool = False
    target_yearly_year: int | None = None
    local_tables_stale_drive_ok: bool = False

    lst_yearly_urban_semantics_bad: bool = False
    """True cuando ``LST_y_urban.csv`` local contradice ``LST_YearMonth_urban.csv``."""

    lst_yearly_csv_clear_scope: str = "all"
    """``all``: limpiar todo ``LST_y_*`` en Drive al re-exportar anual; ``urban_only``: solo ``LST_y_urban``."""

    missing_yearly_raster_years: tuple[int, ...] = ()
    missing_yearly_geo_years: tuple[int, ...] = ()
    drive_missing_yearly_geo_years: tuple[int, ...] = ()
    local_invalid_yearly_geo_years: tuple[int, ...] = ()
    local_all_null_yearly_geo_years: tuple[int, ...] = ()

    sync_full_mirror_extra_keys: frozenset[str] = field(default_factory=frozenset)
    audit_messages: tuple[str, ...] = ()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _list_folder_files(service: Any, folder_display_name: str) -> list[dict]:
    try:
        fid = download_drive_to_repo._find_folder_id(service, folder_display_name)
        return download_drive_to_repo._list_files(service, fid)
    except FileNotFoundError:
        return []


def _yearly_csv_missing_or_stale(
    files: list[dict],
    *,
    target_year: int,
) -> bool:
    """
    True if no CSV exists on Drive or the newest CSV ``modifiedTime`` is from
    *target_year* or earlier (it could not contain that full year's data).
    """
    newest = newest_modified_time_for_prefix(files, "", (".csv",))
    if newest is None:
        return True
    return newest.year <= target_year


def _drive_has_exact_file(files: list[dict], filename: str) -> bool:
    target = filename.lower()
    for f in files:
        name = (f.get("name") or "").lower()
        if name == target:
            return True
    return False


# ---------------------------------------------------------------------------
# Main computation
# ---------------------------------------------------------------------------

def compute_drive_freshness_hints(
    product: str,
    service: Any,
    *,
    target_yearly_year: int,
    assets_cover_target_year: bool = True,
    available_years: list[int] | None = None,
    max_ym_asset: tuple[int, int] | None = None,
    skip_lst_yearly_semantics_audit: bool = False,
) -> DriveFreshnessHints:
    """
    Compute freshness hints by comparing GEE asset years vs Drive contents.

    *max_ym_asset*: máximo (año, mes) en la ImageCollection año-mes del asset GEE.
    Hasta que alcance el último mes civil cerrado UTC, no se marcan brechas **anuales**
    (raster/CSV/GeoJSON) ni validación local de tablas anuales; los rasters mensuales
    en Drive solo disparan espejo si el asset ya está alineado con el reloj.

    *available_years*: distinct years in the GEE asset collection, capped at
    ``target_yearly_year``.  Used for full yearly-gap detection.  When ``None``
    the audit falls back to checking only *target_yearly_year*.

    *skip_lst_yearly_semantics_audit*: si True, no contrasta ``LST_y_urban.csv`` con
    ``LST_YearMonth_urban.csv`` (útil para depuración o cuando el año–mes local está incompleto).
    """
    msgs: list[str] = []

    # --- Product-specific config ---
    monthly_folder: str
    monthly_prefix: str
    yearly_folder: str
    yearly_stem_prefix: str
    mirror_key: str
    monthly_csv_folder: str | None = None
    yearly_csv_folder: str
    monthly_csv_expected_name: str | None = None
    yearly_csv_expected_name: str | None = None
    yearly_geo_folder_b: str
    yearly_geo_folder_m: str
    yearly_geo_stem_prefix_b: str
    yearly_geo_stem_prefix_m: str

    if product == "ndvi":
        monthly_folder = paths.DRIVE_RASTER_MONTHLY
        monthly_prefix = "NDVI_Monthly_"
        yearly_folder = paths.DRIVE_RASTER_YEARLY
        yearly_stem_prefix = "NDVI_Yearly_"
        mirror_key = "raster_monthly"
        monthly_csv_folder = paths.DRIVE_CSV_MONTHLY
        yearly_csv_folder = paths.DRIVE_CSV_YEARLY
        monthly_csv_expected_name = None
        yearly_csv_expected_name = None
        yearly_geo_folder_b = paths.DRIVE_GEO_YEARLY_B
        yearly_geo_folder_m = paths.DRIVE_GEO_YEARLY_M
        yearly_geo_stem_prefix_b = "NDVI_Yearly_ZonalStats_Barrios_"
        yearly_geo_stem_prefix_m = "NDVI_Yearly_ZonalStats_Manzanas_"
    elif product == "aod":
        monthly_folder = paths.DRIVE_AOD_RASTER_MONTHLY
        monthly_prefix = "AOD_Monthly_"
        yearly_folder = paths.DRIVE_AOD_RASTER_YEARLY
        yearly_stem_prefix = "AOD_Yearly_"
        mirror_key = "aod_raster_monthly"
        monthly_csv_folder = paths.DRIVE_AOD_CSV_MONTHLY
        yearly_csv_folder = paths.DRIVE_AOD_CSV_YEARLY
        monthly_csv_expected_name = None
        yearly_csv_expected_name = None
        yearly_geo_folder_b = paths.DRIVE_AOD_GEO_YEARLY_B
        yearly_geo_folder_m = paths.DRIVE_AOD_GEO_YEARLY_M
        yearly_geo_stem_prefix_b = "AOD_Yearly_ZonalStats_Barrios_"
        yearly_geo_stem_prefix_m = "AOD_Yearly_ZonalStats_Manzanas_"
    elif product == "no2":
        monthly_folder = paths.DRIVE_NO2_RASTER_MONTHLY
        monthly_prefix = "NO2_Monthly_"
        yearly_folder = paths.DRIVE_NO2_RASTER_YEARLY
        yearly_stem_prefix = "NO2_Yearly_"
        mirror_key = "no2_raster_monthly"
        monthly_csv_folder = paths.DRIVE_NO2_CSV_MONTHLY
        yearly_csv_folder = paths.DRIVE_NO2_CSV_YEARLY
        monthly_csv_expected_name = "NO2_m_zonal_barrios.csv"
        yearly_csv_expected_name = None
        yearly_geo_folder_b = paths.DRIVE_NO2_GEO_YEARLY_B
        yearly_geo_folder_m = paths.DRIVE_NO2_GEO_YEARLY_M
        yearly_geo_stem_prefix_b = "NO2_Yearly_ZonalStats_Barrios_"
        yearly_geo_stem_prefix_m = "NO2_Yearly_ZonalStats_Manzanas_"
    elif product == "so2":
        monthly_folder = paths.DRIVE_SO2_RASTER_MONTHLY
        monthly_prefix = "SO2_Monthly_"
        yearly_folder = paths.DRIVE_SO2_RASTER_YEARLY
        yearly_stem_prefix = "SO2_Yearly_"
        mirror_key = "so2_raster_monthly"
        monthly_csv_folder = paths.DRIVE_SO2_CSV_MONTHLY
        yearly_csv_folder = paths.DRIVE_SO2_CSV_YEARLY
        monthly_csv_expected_name = "SO2_m_zonal_barrios.csv"
        yearly_csv_expected_name = None
        yearly_geo_folder_b = paths.DRIVE_SO2_GEO_YEARLY_B
        yearly_geo_folder_m = paths.DRIVE_SO2_GEO_YEARLY_M
        yearly_geo_stem_prefix_b = "SO2_Yearly_ZonalStats_Barrios_"
        yearly_geo_stem_prefix_m = "SO2_Yearly_ZonalStats_Manzanas_"
    elif product == "lst":
        monthly_folder = paths.DRIVE_LST_RASTER_MONTHLY
        monthly_prefix = "LST_Monthly_"
        yearly_folder = paths.DRIVE_LST_RASTER_YEARLY
        yearly_stem_prefix = "LST_Yearly_"
        mirror_key = "lst_raster_monthly"
        monthly_csv_folder = paths.DRIVE_LST_CSV_MONTHLY
        yearly_csv_folder = paths.DRIVE_LST_CSV_YEARLY
        monthly_csv_expected_name = "LST_m_urban.csv"
        yearly_csv_expected_name = "LST_y_urban.csv"
        yearly_geo_folder_b = paths.DRIVE_LST_GEO_YEARLY_B
        yearly_geo_folder_m = paths.DRIVE_LST_GEO_YEARLY_M
        yearly_geo_stem_prefix_b = "LST_Yearly_ZonalStats_Barrios_"
        yearly_geo_stem_prefix_m = "LST_Yearly_ZonalStats_Manzanas_"
    else:
        return DriveFreshnessHints(target_yearly_year=target_yearly_year)

    expected_years = available_years or [target_yearly_year]

    lst_yearly_urban_semantics_bad = False
    lst_yearly_csv_clear_scope = "all"

    wall = ym_lib.last_complete_calendar_month_utc()
    asset_reaches_wall = max_ym_asset is not None and not ym_lib.ym_strictly_before(
        max_ym_asset, wall
    )
    if max_ym_asset is None:
        msgs.append(
            "[Drive audit] Colección año-mes GEE vacía o sin máximo (year/month): "
            "no se comparan brechas anuales ni tablas en Drive hasta tener datos en el asset."
        )
    elif not asset_reaches_wall:
        max_s = f"{max_ym_asset[0]}-{max_ym_asset[1]:02d}"
        msgs.append(
            f"[Drive audit] Alineación mensual: el asset GEE llega hasta {max_s}; "
            f"el último mes civil cerrado UTC es {wall[0]}-{wall[1]:02d}. "
            "No se marcan faltantes de rasters/CSV/GeoJSON **anuales** por Drive "
            "ni validación local de tablas anuales hasta completar el asset. "
            "La frescura de rasters mensuales (climatología) en Drive solo aplica si el asset "
            "está al día con ese mes."
        )

    # --- Monthly: mtime vs último mes cerrado UTC (rasters mensuales / climatología) ---
    m_files = _list_folder_files(service, monthly_folder)
    force_monthly_candidate = monthly_stale_from_drive_mtime(
        m_files, monthly_prefix, (".tif", ".tiff"), wall_month=wall
    )
    force_monthly = force_monthly_candidate and asset_reaches_wall
    if force_monthly:
        msgs.append(
            f"[Drive audit] Mensual «{monthly_folder}»: la fecha de última modificación en "
            f"Drive es anterior a {wall[0]}-{wall[1]:02d} (último mes civil cerrado UTC) — "
            "se hará espejo completo desde Drive."
        )
    elif force_monthly_candidate and not asset_reaches_wall:
        msgs.append(
            f"[Drive audit] Mensual «{monthly_folder}»: Drive sugiere refresco por fecha, "
            "pero el asset año-mes aún no cubre el último mes cerrado UTC — "
            "se pospone el espejo de rasters mensuales hasta alinear GEE."
        )

    if asset_reaches_wall:
        # --- Yearly rasters: full gap detection ---
        y_files = _list_folder_files(service, yearly_folder)
        missing_raster_years = _find_missing_yearly_files(
            y_files, yearly_stem_prefix, (".tif", ".tiff"), expected_years,
        )
        yearly_missing = bool(missing_raster_years)
        yearly_bypass = yearly_missing and assets_cover_target_year
        if missing_raster_years:
            yrs_str = ", ".join(str(y) for y in missing_raster_years)
            msgs.append(
                f"[Drive audit] Raster anual «{yearly_folder}»: faltan años [{yrs_str}]."
            )
        if yearly_missing and not assets_cover_target_year:
            msgs.append(
                f"[Drive audit] El asset aún no cubre dic. {target_yearly_year}; "
                "no se fuerza reexport hasta completar ese año en GEE."
            )

        # --- Yearly CSV: modifiedTime check + canonical filename presence ---
        csv_y_files = _list_folder_files(service, yearly_csv_folder)
        yearly_csv_missing = _yearly_csv_missing_or_stale(
            csv_y_files, target_year=target_yearly_year,
        )
        if yearly_csv_expected_name and not _drive_has_exact_file(
            csv_y_files, yearly_csv_expected_name
        ):
            yearly_csv_missing = True
            msgs.append(
                f"[Drive audit] CSV anual «{yearly_csv_folder}»: falta archivo canónico "
                f"{yearly_csv_expected_name}."
            )
        if monthly_csv_expected_name and monthly_csv_folder:
            csv_m_files = _list_folder_files(service, monthly_csv_folder)
            if not _drive_has_exact_file(csv_m_files, monthly_csv_expected_name):
                yearly_csv_missing = True
                msgs.append(
                    f"[Drive audit] CSV mensual «{monthly_csv_folder}»: falta archivo canónico "
                    f"{monthly_csv_expected_name}."
                )
            ym_drive_name = {"lst": "LST_YearMonth_urban.csv"}.get(product)
            if ym_drive_name and not _drive_has_exact_file(csv_m_files, ym_drive_name):
                msgs.append(
                    f"[Drive audit] CSV año-mes «{monthly_csv_folder}»: falta en Drive "
                    f"{ym_drive_name} (export GEE pendiente o distinto nombre)."
                )
        if product == "ndvi":
            csv_ndvi_m = _list_folder_files(service, paths.DRIVE_CSV_MONTHLY)
            zonal_name = "NDVI_m_zonal_barrios.csv"
            if not _drive_has_exact_file(csv_ndvi_m, zonal_name):
                msgs.append(
                    f"[Drive audit] CSV mensual «{paths.DRIVE_CSV_MONTHLY}»: falta en Drive "
                    f"{zonal_name} (P25/P75/anio_actual explorador zonal; export GEE)."
                )
            csv_ndvi_y = _list_folder_files(service, paths.DRIVE_CSV_YEARLY)
            zonal_y_name = "NDVI_y_zonal_barrios.csv"
            if not _drive_has_exact_file(csv_ndvi_y, zonal_y_name):
                yearly_csv_missing = True
                msgs.append(
                    f"[Drive audit] CSV anual «{paths.DRIVE_CSV_YEARLY}»: falta en Drive "
                    f"{zonal_y_name} (serie anual zonal P25/P50/P75; export GEE "
                    f"``start_ndvi_y_csv_tasks``)."
                )
        elif product == "lst":
            csv_lst_m = _list_folder_files(service, paths.DRIVE_LST_CSV_MONTHLY)
            zonal_name_m = "LST_m_zonal_barrios.csv"
            if not _drive_has_exact_file(csv_lst_m, zonal_name_m):
                msgs.append(
                    f"[Drive audit] CSV mensual «{paths.DRIVE_LST_CSV_MONTHLY}»: falta en Drive "
                    f"{zonal_name_m} (P25/P75/anio_actual explorador zonal LST; export GEE)."
                )
            csv_lst_y = _list_folder_files(service, paths.DRIVE_LST_CSV_YEARLY)
            zonal_y_name = "LST_y_zonal_barrios.csv"
            if not _drive_has_exact_file(csv_lst_y, zonal_y_name):
                yearly_csv_missing = True
                msgs.append(
                    f"[Drive audit] CSV anual «{paths.DRIVE_LST_CSV_YEARLY}»: falta en Drive "
                    f"{zonal_y_name} (serie anual zonal LST; export GEE pendiente o distinto nombre)."
                )
        if yearly_csv_missing:
            msgs.append(
                f"[Drive audit] CSV anual «{yearly_csv_folder}»: faltante o desactualizado "
                f"para {target_yearly_year}."
            )

        # --- Yearly GeoJSON: full gap detection ---
        geo_y_files_b = _list_folder_files(service, yearly_geo_folder_b)
        geo_y_files_m = _list_folder_files(service, yearly_geo_folder_m)
        drive_missing_geo_years = _find_missing_yearly_geo(
            geo_y_files_b, geo_y_files_m,
            yearly_geo_stem_prefix_b, yearly_geo_stem_prefix_m,
            (".geojson", ".json"),
            expected_years,
        )
        yearly_geo_missing = bool(drive_missing_geo_years)
        if drive_missing_geo_years:
            yrs_str = ", ".join(str(y) for y in drive_missing_geo_years)
            msgs.append(
                f"[Drive audit] GeoJSON anual: faltan años [{yrs_str}] en Barrios/Manzanas."
            )

        # --- Local GeoJSON content validation (null-value detection) ---
        local_geo_invalid_years = _validate_local_geojsons_for_years(product, expected_years)
        local_all_null_geo_years = _local_yearly_geo_all_null_years_for_product(
            product, expected_years
        )
        if local_all_null_geo_years:
            yrs_str = ", ".join(str(y) for y in local_all_null_geo_years)
            msgs.append(
                f"[Drive audit] GeoJSON local todo-null (barrios+manzanas): años [{yrs_str}] — "
                "se forzará re-export desde GEE (no basta re-descargar Drive)."
            )

        if local_geo_invalid_years:
            yrs_str = ", ".join(str(y) for y in local_geo_invalid_years)
            msgs.append(
                f"[Drive audit] GeoJSON local con valores nulos: años [{yrs_str}] — "
                "se eliminarán en local para re-descargar desde Drive."
            )
            yearly_geo_missing = True
            # Delete invalid local files so incremental download will replace them
            specs = _LOCAL_YEARLY_GEO_TARGETS.get(product, {})
            for year in local_geo_invalid_years:
                for _zone, (directory, prefix, _vprop) in specs.items():
                    fpath = directory / f"{prefix}{year}.geojson"
                    if fpath.is_file():
                        fpath.unlink()
                        msgs.append(
                            f"[Drive audit] Eliminado local inválido: {fpath.name}"
                        )

        yearly_tables_missing = yearly_csv_missing or yearly_geo_missing

        # --- Local CSV content validation ---
        local_csv_ok, csv_reasons, csv_completely_invalid = _validate_all_local_csvs(
            product, expected_years
        )
        local_monthly_csv_ok, monthly_csv_reasons, monthly_invalid_paths = (
            _validate_all_local_monthly_csvs(product)
        )
        ym_csv_ok, ym_csv_reasons, ym_csv_invalid_paths = _validate_local_yearmonth_csvs(
            product
        )
        clim_local_stale = (not local_csv_ok) or (not local_monthly_csv_ok)
        ym_local_stale = not ym_csv_ok
        local_csv_stale = clim_local_stale or ym_local_stale

        if (
            product == "lst"
            and not skip_lst_yearly_semantics_audit
        ):
            y_csv = paths.REPO_CSV_LST / "LST_y_urban.csv"
            ym_csv = paths.REPO_CSV_LST / "LST_YearMonth_urban.csv"
            sem_ok, sem_msgs = audit_lst_y_urban_semantics_vs_yearmonth(y_csv, ym_csv)
            if not sem_ok:
                lst_yearly_urban_semantics_bad = True
                yearly_csv_missing = True
                local_csv_stale = True
                for m in sem_msgs:
                    msgs.append(f"[Drive audit] {m}")
                zb_csv = paths.REPO_CSV_LST / "LST_y_zonal_barrios.csv"
                ok_u, _, _ = _validate_local_csv(
                    y_csv,
                    expected_years,
                    "Year",
                    ["LST_mean", "LST_p25", "LST_p75"],
                )
                ok_zb, _, _ = _validate_local_csv(
                    zb_csv,
                    expected_years,
                    "Year",
                    ["LST_mean", "LST_p25", "LST_p75"],
                )
                if ok_u and ok_zb:
                    lst_yearly_csv_clear_scope = "urban_only"
                if y_csv.is_file():
                    y_csv.unlink()
                    msgs.append(
                        "[Drive audit] Eliminado local (semántica LST): LST_y_urban.csv"
                    )

        if csv_completely_invalid:
            msgs.append(
                "[Drive audit] CSV local completamente inválido (todos los valores vacíos) — "
                "se forzará re-export desde GEE (no solo descarga de Drive)."
            )
            yearly_csv_missing = True
            local_stale_drive_ok = False
        else:
            # Si el mensual local falla (cabecera P25/P75, etc.), no confiar en
            # «Drive tiene CSV reciente»: el archivo en Drive puede ser el antiguo
            # sin percentiles; hay que re-exportar y luego descargar.
            local_stale_drive_ok = (
                clim_local_stale
                and not yearly_csv_missing
                and local_monthly_csv_ok
            )

        if local_csv_stale:
            for reason in csv_reasons:
                msgs.append(f"[Drive audit] CSV local inválido: {reason}")
            for reason in monthly_csv_reasons:
                msgs.append(f"[Drive audit] CSV local inválido: {reason}")
            for reason in ym_csv_reasons:
                msgs.append(f"[Drive audit] CSV año-mes local: {reason}")
            for csv_path, _year_col, _val_cols in _LOCAL_YEARLY_CSV_TARGETS.get(product, []):
                if csv_path.is_file() and any(csv_path.name in reason for reason in csv_reasons):
                    csv_path.unlink()
                    msgs.append(
                        f"[Drive audit] Eliminado local inválido: {csv_path.name}"
                    )
            for csv_path in monthly_invalid_paths:
                if csv_path.is_file():
                    csv_path.unlink()
                    msgs.append(
                        f"[Drive audit] Eliminado local inválido: {csv_path.name}"
                    )
            for csv_path in ym_csv_invalid_paths:
                if csv_path.is_file():
                    csv_path.unlink()
                    msgs.append(
                        f"[Drive audit] Eliminado local inválido: {csv_path.name}"
                    )
            if local_stale_drive_ok:
                msgs.append(
                    "[Drive audit] Drive parece tener CSV reciente — "
                    "se descargará sin re-exportar."
                )

        yearly_tables_missing = yearly_tables_missing or local_csv_stale

    else:
        missing_raster_years = []
        yearly_missing = False
        yearly_bypass = False
        yearly_csv_missing = False
        yearly_geo_missing = False
        drive_missing_geo_years = []
        local_geo_invalid_years = []
        local_all_null_geo_years = []
        yearly_tables_missing = False
        local_csv_stale = False
        clim_local_stale = False
        ym_local_stale = False
        local_stale_drive_ok = False

    # --- Sync mirror keys ---
    extra: set[str] = set()
    if force_monthly:
        extra.add(mirror_key)
    yearly_mirror_trigger = (
        (yearly_csv_missing and assets_cover_target_year) or clim_local_stale
    )
    if yearly_mirror_trigger:
        if product == "lst" and lst_yearly_csv_clear_scope == "urban_only":
            extra.add("lst_csv_yearly")
        elif product in _CSV_TABLE_MIRROR_KEYS:
            extra.update(_CSV_TABLE_MIRROR_KEYS[product])

    return DriveFreshnessHints(
        force_full_monthly_raster_export=force_monthly,
        yearly_raster_missing_or_stale=yearly_missing,
        yearly_tables_missing_or_stale=yearly_tables_missing,
        yearly_csv_missing_or_stale=yearly_csv_missing,
        local_csv_stale=local_csv_stale,
        clim_csv_local_stale=clim_local_stale,
        yearmonth_csv_local_stale=ym_local_stale,
        yearly_geo_missing_or_stale=yearly_geo_missing,
        yearly_raster_enqueue_bypass=yearly_bypass,
        mirror_full_monthly_local=force_monthly,
        target_yearly_year=target_yearly_year,
        local_tables_stale_drive_ok=local_stale_drive_ok,
        lst_yearly_urban_semantics_bad=lst_yearly_urban_semantics_bad,
        lst_yearly_csv_clear_scope=lst_yearly_csv_clear_scope,
        missing_yearly_raster_years=tuple(missing_raster_years),
        missing_yearly_geo_years=tuple(drive_missing_geo_years),
        drive_missing_yearly_geo_years=tuple(drive_missing_geo_years),
        local_invalid_yearly_geo_years=tuple(local_geo_invalid_years),
        local_all_null_yearly_geo_years=tuple(local_all_null_geo_years),
        sync_full_mirror_extra_keys=frozenset(extra),
        audit_messages=tuple(msgs),
    )
