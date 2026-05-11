"""
Actualiza el catálogo de años y el título de iluminación del front-end (GENIUS).

Lee CSV anuales, NDVI mensual urbano, GeoJSON zonal y **rasters** ``NDVI_Yearly_*.tif`` /
``LST_Yearly_*.tif``, construye listas de años por producto (incl. ``ndvi_raster`` solo con
.tif presentes; **lst** desde 1997: unión de ``LST_y_urban.csv``, TIF anuales y GeoJSON zonal barrios)
y escribe ``assets/js/genius_map_catalog.generated.js``.

Ejecución automática tras sync en ``pipeline`` y ``download_drive_to_repo``; también:

    python -m scripts.gee.lib.genius_frontend_catalog

El título de iluminación proviene de
``assets/data/raster/Iluminacion/illumination_front_catalog.json`` (lo escribe
``scripts.repo.rasters.convert_illumination`` al procesar el TIF).
"""
from __future__ import annotations

import csv
import json
import re
import sys
from pathlib import Path

from ..config import paths
from ..products.lst.constants import LST_NULL_SERIES_YEARS, LST_PRODUCT_MIN_YEAR
from .ndvi_m_urban_wall_audit import (
    last_complete_calendar_month_utc_py,
    ndvi_m_urban_anio_valid_for_wall_months,
)

# Si faltan CSV en local (checkout parcial), usar estos rangos hasta el próximo sync.
_FALLBACK_RANGES: dict[str, tuple[int, int]] = {
    "ndvi": (2016, 2026),
    # LST: solo años ≥ 1997 (coherente con pipeline GEE y derivados).
    "lst": (LST_PRODUCT_MIN_YEAR, 2025),
    "aod": (2001, 2025),
    "no2": (2019, 2025),
    "so2": (2019, 2025),
    "hu": (2018, 2026),
}

_DEFAULT_ILLUMINATION_TITLE = "Iluminación - Invierno 2024"

_GENERATED_REL = Path("assets/js/genius_map_catalog.generated.js")
_ILLUM_JSON = (
    paths.PROJECT_ROOT
    / "assets/data/raster/Iluminacion/illumination_front_catalog.json"
)


def _year_set_from_csv(csv_path: Path, year_col: str = "Year") -> set[int]:
    if not csv_path.is_file():
        return set()
    out: set[int] = set()
    try:
        with csv_path.open(encoding="utf-8", errors="replace", newline="") as f:
            reader = csv.DictReader(f)
            if not reader.fieldnames or year_col not in reader.fieldnames:
                return set()
            for row in reader:
                raw = (row.get(year_col) or "").strip()
                if not raw:
                    continue
                try:
                    y = int(float(raw))
                except (ValueError, OverflowError):
                    continue
                out.add(y)
    except OSError:
        return set()
    return out


def _filled_range(years: set[int], fallback: tuple[int, int]) -> list[int]:
    if not years:
        lo, hi = fallback
        return list(range(lo, hi + 1))
    lo, hi = min(years), max(years)
    return list(range(lo, hi + 1))


def _year_set_ndvi_yearly_raster() -> set[int]:
    """Años con composito anual NDVI píxel en disco (NDVI_Yearly_YYYY.tif)."""
    d = paths.PROJECT_ROOT / "assets/data/raster/NDVI/NDVI_Yearly"
    if not d.is_dir():
        return set()
    pat = re.compile(r"^NDVI_Yearly_(\d{4})\.(?:tif|TIF)$")
    out: set[int] = set()
    for p in d.iterdir():
        if not p.is_file():
            continue
        m = pat.match(p.name)
        if m:
            out.add(int(m.group(1)))
    return out


def _year_set_ndvi_zonal_geojson() -> set[int]:
    """Años con capa anual zonal en disco (barrios ∩ manzanas si ambas existen)."""
    root = paths.PROJECT_ROOT / "assets/data/geojson/NDVI/NDVI_Yearly_ZonalStats"
    d_b = root / "NDVI_Yearly_ZonalStats_Barrios"
    d_m = root / "NDVI_Yearly_ZonalStats_Manzanas"
    pat_b = re.compile(r"^NDVI_Yearly_ZonalStats_Barrios_(\d{4})\.geojson$")
    pat_m = re.compile(r"^NDVI_Yearly_ZonalStats_Manzanas_(\d{4})\.geojson$")

    def scan(d: Path, rx: re.Pattern[str]) -> set[int]:
        if not d.is_dir():
            return set()
        out: set[int] = set()
        for p in d.iterdir():
            if not p.is_file():
                continue
            m = rx.match(p.name)
            if m:
                out.add(int(m.group(1)))
        return out

    y_b, y_m = scan(d_b, pat_b), scan(d_m, pat_m)
    if y_b and y_m:
        return y_b & y_m
    return y_b or y_m


def _year_set_lst_yearly_raster() -> set[int]:
    """Años con composito anual LST píxel en disco (LST_Yearly_YYYY.tif)."""
    d = paths.PROJECT_ROOT / "assets/data/raster/LST/LST_Yearly"
    if not d.is_dir():
        return set()
    pat = re.compile(r"^LST_Yearly_(\d{4})\.(?:tif|TIF)$")
    out: set[int] = set()
    for p in d.iterdir():
        if not p.is_file():
            continue
        m = pat.match(p.name)
        if m:
            out.add(int(m.group(1)))
    return out


def _year_set_lst_zonal_geojson_barrios() -> set[int]:
    """Años con capa anual zonal barrios LST en disco."""
    d = (
        paths.PROJECT_ROOT
        / "assets/data/geojson/LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Barrios"
    )
    if not d.is_dir():
        return set()
    pat = re.compile(r"^LST_Yearly_ZonalStats_Barrios_(\d{4})\.geojson$")
    out: set[int] = set()
    for p in d.iterdir():
        if not p.is_file():
            continue
        m = pat.match(p.name)
        if m:
            out.add(int(m.group(1)))
    return out


def _lst_catalog_years() -> list[int]:
    """Años LST en UI: unión local (CSV / TIF / GeoJSON barrios), solo ``year >= 1997``."""
    csv_y = _year_set_from_csv(paths.REPO_CSV_LST / "LST_y_urban.csv")
    r_y = _year_set_lst_yearly_raster()
    z_y = _year_set_lst_zonal_geojson_barrios()
    combined = csv_y | r_y | z_y
    if not combined:
        lo, hi = _FALLBACK_RANGES["lst"]
        lo = max(lo, LST_PRODUCT_MIN_YEAR)
        return list(range(lo, hi + 1))
    return sorted(
        y for y in combined if y >= LST_PRODUCT_MIN_YEAR and y not in LST_NULL_SERIES_YEARS
    )


def compute_product_years() -> dict[str, list[int]]:
    # Años NDVI desde CSV anuales del repo (p. ej. NDVI_y_urban, NDVI_y_av).
    ndvi_y = _year_set_from_csv(paths.REPO_CSV / "NDVI_y_urban.csv")
    ndvi_y |= _year_set_from_csv(paths.REPO_CSV / "NDVI_y_av.csv")
    # Año del último mes cerrado si el mensual urbano ya trae ``anio_actual`` (p. ej. 2026
    # antes de existir fila en NDVI_y_urban).
    _urban_m = paths.REPO_CSV / "NDVI_m_urban.csv"
    if ndvi_m_urban_anio_valid_for_wall_months(_urban_m):
        ly, _lm = last_complete_calendar_month_utc_py()
        ndvi_y.add(ly)

    hu_y = _year_set_from_csv(paths.REPO_CSV_HU / "Huella_Urbana_Anual.csv")
    hu_y |= _year_set_from_csv(paths.REPO_CSV_HU / "Areas_Huella_Urbana_Yearly.csv")

    zonal_gj = _year_set_ndvi_zonal_geojson()
    ndvi_zonal = sorted(zonal_gj) if zonal_gj else _filled_range(ndvi_y, _FALLBACK_RANGES["ndvi"])

    ndvi_raster_y = _year_set_ndvi_yearly_raster()
    ndvi_list = _filled_range(ndvi_y, _FALLBACK_RANGES["ndvi"])
    # No ofrecer en catálogo NDVI años por encima del último anual raster (evita p. ej. 2026
    # por ``anio_actual`` en mensual si aún no existe NDVI_Yearly_2026.tif).
    if ndvi_raster_y:
        hi_r = max(ndvi_raster_y)
        ndvi_list = [y for y in ndvi_list if y <= hi_r]
    ndvi_raster = sorted(ndvi_raster_y) if ndvi_raster_y else list(ndvi_list)

    return {
        "ndvi": ndvi_list,
        "ndvi_zonal": ndvi_zonal,
        "ndvi_raster": ndvi_raster,
        "lst": _lst_catalog_years(),
        "aod": _filled_range(
            _year_set_from_csv(paths.REPO_CSV_AOD / "AOD_y_urban.csv"),
            _FALLBACK_RANGES["aod"],
        ),
        "no2": [
            y for y in _filled_range(
                _year_set_from_csv(paths.REPO_CSV_NO2 / "NO2_y_urban.csv"),
                _FALLBACK_RANGES["no2"],
            )
            if y != 2018
        ],
        "so2": [
            y for y in _filled_range(
                _year_set_from_csv(paths.REPO_CSV_SO2 / "SO2_y_urban.csv"),
                _FALLBACK_RANGES["so2"],
            )
            if y != 2018
        ],
        "hu": _filled_range(hu_y, _FALLBACK_RANGES["hu"]),
    }


def _read_illumination_title() -> str:
    if not _ILLUM_JSON.is_file():
        return _DEFAULT_ILLUMINATION_TITLE
    try:
        data = json.loads(_ILLUM_JSON.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return _DEFAULT_ILLUMINATION_TITLE
    title = data.get("map_title")
    if isinstance(title, str) and title.strip():
        return title.strip()
    return _DEFAULT_ILLUMINATION_TITLE


def _js_int_list(values: list[int]) -> str:
    return ", ".join(str(x) for x in values)


def write_generated_js(
    *,
    project_root: Path | None = None,
    dry_run: bool = False,
) -> Path:
    root = project_root or paths.PROJECT_ROOT
    out_path = root / _GENERATED_REL
    years_map = compute_product_years()
    illum = _read_illumination_title()
    illum_js = json.dumps(illum, ensure_ascii=False)

    lines = [
        "/**",
        " * Catálogo de años por producto y título del mapa de iluminación.",
        " * GENERADO — no editar. Origen: python -m scripts.gee.lib.genius_frontend_catalog",
        " * (pipeline GEE / descarga Drive / python -m scripts.repo.rasters.convert_illumination).",
        " */",
        "",
        "export const PRODUCT_YEARS = Object.freeze({",
    ]
    for key in ("ndvi", "ndvi_zonal", "ndvi_raster", "lst", "aod", "no2", "so2", "hu"):
        ys = years_map[key]
        lines.append(
            f"    {key}: Object.freeze([{_js_int_list(ys)}]),",
        )
    lines.append("});")
    lines.append("")
    lines.append(f"export const GENIUS_ILLUMINATION_MAP_TITLE = {illum_js};")
    lines.append("")

    text = "\n".join(lines)
    if dry_run:
        print(text)
        return out_path
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(text, encoding="utf-8")
    return out_path


def refresh_genius_frontend_catalog(
    *,
    project_root: Path | None = None,
    dry_run: bool = False,
    quiet: bool = False,
) -> Path:
    path = write_generated_js(project_root=project_root, dry_run=dry_run)
    if not quiet and not dry_run:
        print(f"✓ Catálogo front GENIUS actualizado: {path.relative_to(paths.PROJECT_ROOT)}")
    return path


def main(argv: list[str] | None = None) -> None:
    dry = "--dry-run" in (argv or sys.argv[1:])
    refresh_genius_frontend_catalog(dry_run=dry, quiet=dry)


if __name__ == "__main__":
    main()
