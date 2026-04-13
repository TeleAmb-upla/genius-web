"""
Auditoría de frescura en Google Drive antes de encolar exportaciones EE.

Reglas:
- **Mensual**: solo para espejo local (Drive → repo). No se usa para disparar re-exports GEE.
- **Anual**: se buscan TODAS las brechas anuales (no solo el último año) comparando los
  años disponibles en el asset GEE (hasta ``target_yearly_year``) vs los archivos en Drive.
- **CSV**: se valida el contenido local (años presentes, datos no vacíos / NaN).
"""
from __future__ import annotations

import csv
import datetime
import io
import math
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from ..config import paths
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
) -> bool:
    """True when the monthly Drive folder looks stale (for mirror/sync decisions only)."""
    last_cy = ym_lib.last_completed_wall_clock_calendar_year()
    newest = newest_modified_time_for_prefix(files, monthly_name_prefix, extensions)
    if newest is None:
        return True
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

_LOCAL_YEARLY_CSV_TARGETS: dict[str, list[tuple[Path, str, list[str]]]] = {
    # (csv_path, year_column, value_columns_to_check)
    "ndvi": [
        (paths.REPO_CSV / "NDVI_y_urban.csv", "Year", ["NDVI"]),
    ],
    "aod": [
        (paths.REPO_CSV_AOD / "AOD_y_region.csv", "Year", ["AOD_median"]),
    ],
    "no2": [
        (paths.REPO_CSV_NO2 / "NO2_y_region.csv", "Year", ["NO2_median"]),
    ],
    "so2": [
        (paths.REPO_CSV_SO2 / "SO2_y_region.csv", "Year", ["SO2"]),
    ],
    "lst": [
        (paths.REPO_CSV_LST / "LST_y_urban.csv", "Year", ["LST_mean"]),
    ],
}

_LOCAL_MONTHLY_CSV_TARGETS: dict[str, list[tuple[Path, str, list[int], list[str]]]] = {
    "aod": [
        (
            paths.REPO_CSV_AOD / "AOD_m_region.csv",
            "Month",
            list(range(1, 13)),
            ["AOD_median"],
        ),
    ],
    "no2": [
        (
            paths.REPO_CSV_NO2 / "NO2_m_region.csv",
            "Month",
            list(range(1, 13)),
            ["NO2_median"],
        ),
    ],
    "so2": [
        (
            paths.REPO_CSV_SO2 / "SO2_m_region.csv",
            "Month",
            list(range(1, 13)),
            ["SO2"],
        ),
    ],
    "lst": [
        (
            paths.REPO_CSV_LST / "LST_m_urban.csv",
            "Month",
            list(range(1, 13)),
            ["LST_mean"],
        ),
    ],
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
    3. The *value_columns* for those rows are not empty / NaN.
    """
    if not csv_path.is_file():
        return False, f"archivo no existe: {csv_path.name}", len(expected_years)
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
        has_value = False
        for col in check_cols:
            cell = row.get(col, "")
            if not _is_value_empty_or_nan(cell):
                has_value = True
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
    return all_ok, reasons, invalid_paths


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
    yearly_geo_missing_or_stale: bool = False
    yearly_raster_enqueue_bypass: bool = False
    mirror_full_monthly_local: bool = False
    target_yearly_year: int | None = None
    local_tables_stale_drive_ok: bool = False

    missing_yearly_raster_years: tuple[int, ...] = ()
    missing_yearly_geo_years: tuple[int, ...] = ()
    drive_missing_yearly_geo_years: tuple[int, ...] = ()
    local_invalid_yearly_geo_years: tuple[int, ...] = ()

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
) -> DriveFreshnessHints:
    """
    Compute freshness hints by comparing GEE asset years vs Drive contents.

    *available_years*: distinct years in the GEE asset collection, capped at
    ``target_yearly_year``.  Used for full yearly-gap detection.  When ``None``
    the audit falls back to checking only *target_yearly_year*.
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
    yearly_csv_mirror_key: str

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
        yearly_csv_mirror_key = "csv"
    elif product == "aod":
        monthly_folder = paths.DRIVE_AOD_RASTER_MONTHLY
        monthly_prefix = "AOD_Monthly_"
        yearly_folder = paths.DRIVE_AOD_RASTER_YEARLY
        yearly_stem_prefix = "AOD_Yearly_"
        mirror_key = "aod_raster_monthly"
        monthly_csv_folder = paths.DRIVE_AOD_CSV_MONTHLY
        yearly_csv_folder = paths.DRIVE_AOD_CSV_YEARLY
        monthly_csv_expected_name = "AOD_m_region.csv"
        yearly_csv_expected_name = "AOD_y_region.csv"
        yearly_geo_folder_b = paths.DRIVE_AOD_GEO_YEARLY_B
        yearly_geo_folder_m = paths.DRIVE_AOD_GEO_YEARLY_M
        yearly_geo_stem_prefix_b = "AOD_Yearly_ZonalStats_Barrios_"
        yearly_geo_stem_prefix_m = "AOD_Yearly_ZonalStats_Manzanas_"
        yearly_csv_mirror_key = "aod_csv_yearly"
    elif product == "no2":
        monthly_folder = paths.DRIVE_NO2_RASTER_MONTHLY
        monthly_prefix = "NO2_Monthly_"
        yearly_folder = paths.DRIVE_NO2_RASTER_YEARLY
        yearly_stem_prefix = "NO2_Yearly_"
        mirror_key = "no2_raster_monthly"
        monthly_csv_folder = paths.DRIVE_NO2_CSV_MONTHLY
        yearly_csv_folder = paths.DRIVE_NO2_CSV_YEARLY
        monthly_csv_expected_name = "NO2_m_region.csv"
        yearly_csv_expected_name = "NO2_y_region.csv"
        yearly_geo_folder_b = paths.DRIVE_NO2_GEO_YEARLY_B
        yearly_geo_folder_m = paths.DRIVE_NO2_GEO_YEARLY_M
        yearly_geo_stem_prefix_b = "NO2_Yearly_ZonalStats_Barrios_"
        yearly_geo_stem_prefix_m = "NO2_Yearly_ZonalStats_Manzanas_"
        yearly_csv_mirror_key = "no2_csv_yearly"
    elif product == "so2":
        monthly_folder = paths.DRIVE_SO2_RASTER_MONTHLY
        monthly_prefix = "SO2_Monthly_"
        yearly_folder = paths.DRIVE_SO2_RASTER_YEARLY
        yearly_stem_prefix = "SO2_Yearly_"
        mirror_key = "so2_raster_monthly"
        monthly_csv_folder = paths.DRIVE_SO2_CSV_MONTHLY
        yearly_csv_folder = paths.DRIVE_SO2_CSV_YEARLY
        monthly_csv_expected_name = "SO2_m_region.csv"
        yearly_csv_expected_name = "SO2_y_region.csv"
        yearly_geo_folder_b = paths.DRIVE_SO2_GEO_YEARLY_B
        yearly_geo_folder_m = paths.DRIVE_SO2_GEO_YEARLY_M
        yearly_geo_stem_prefix_b = "SO2_Yearly_ZonalStats_Barrios_"
        yearly_geo_stem_prefix_m = "SO2_Yearly_ZonalStats_Manzanas_"
        yearly_csv_mirror_key = "so2_csv_yearly"
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
        yearly_csv_mirror_key = "lst_csv_yearly"
    else:
        return DriveFreshnessHints(target_yearly_year=target_yearly_year)

    expected_years = available_years or [target_yearly_year]

    # --- Monthly: mtime check (for mirror sync only, NOT for GEE re-export) ---
    m_files = _list_folder_files(service, monthly_folder)
    force_monthly = monthly_stale_from_drive_mtime(
        m_files, monthly_prefix, (".tif", ".tiff")
    )
    if force_monthly:
        msgs.append(
            f"[Drive audit] Mensual «{monthly_folder}»: archivos locales desactualizados — "
            f"se hará espejo completo desde Drive."
        )

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
    local_csv_stale = (not local_csv_ok) or (not local_monthly_csv_ok)

    if csv_completely_invalid:
        msgs.append(
            "[Drive audit] CSV local completamente inválido (todos los valores vacíos) — "
            "se forzará re-export desde GEE (no solo descarga de Drive)."
        )
        yearly_csv_missing = True
        local_stale_drive_ok = False
    else:
        local_stale_drive_ok = local_csv_stale and not yearly_csv_missing

    if local_csv_stale:
        for reason in csv_reasons:
            msgs.append(f"[Drive audit] CSV local inválido: {reason}")
        for reason in monthly_csv_reasons:
            msgs.append(f"[Drive audit] CSV local inválido: {reason}")
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
        if local_stale_drive_ok:
            msgs.append(
                "[Drive audit] Drive parece tener CSV reciente — "
                "se descargará sin re-exportar."
            )

    yearly_tables_missing = yearly_tables_missing or local_csv_stale

    # --- Sync mirror keys ---
    extra: set[str] = set()
    if force_monthly:
        extra.add(mirror_key)
    if (yearly_csv_missing and assets_cover_target_year) or local_csv_stale:
        extra.add(yearly_csv_mirror_key)

    return DriveFreshnessHints(
        force_full_monthly_raster_export=force_monthly,
        yearly_raster_missing_or_stale=yearly_missing,
        yearly_tables_missing_or_stale=yearly_tables_missing,
        yearly_csv_missing_or_stale=yearly_csv_missing,
        local_csv_stale=local_csv_stale,
        yearly_geo_missing_or_stale=yearly_geo_missing,
        yearly_raster_enqueue_bypass=yearly_bypass,
        mirror_full_monthly_local=force_monthly,
        target_yearly_year=target_yearly_year,
        local_tables_stale_drive_ok=local_stale_drive_ok,
        missing_yearly_raster_years=tuple(missing_raster_years),
        missing_yearly_geo_years=tuple(drive_missing_geo_years),
        drive_missing_yearly_geo_years=tuple(drive_missing_geo_years),
        local_invalid_yearly_geo_years=tuple(local_geo_invalid_years),
        sync_full_mirror_extra_keys=frozenset(extra),
        audit_messages=tuple(msgs),
    )
