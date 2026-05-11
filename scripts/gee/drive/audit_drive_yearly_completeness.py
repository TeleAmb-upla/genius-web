"""
Comprueba que las carpetas de Google Drive alineadas a ``paths.py`` tengan
exports **anuales** hasta un año objetivo (por defecto: último año civil completo, p. ej. 2025).

- Rasters anuales: existe ``{Prefijo}{año}.tif`` (p. ej. ``NDVI_Yearly_2025.tif``).
- GeoJSON anuales (por año en el nombre): existe ``{Prefijo}{año}.geojson``.
- CSV agregados: se busca una fila que empiece por ``{año}.`` o ``{año},`` y se advierte si parece vacía.

Uso (raíz del repo, con credenciales EE/Drive ya configuradas):

    python -m scripts.gee.drive.audit_drive_yearly_completeness
    python -m scripts.gee.drive.audit_drive_yearly_completeness --year 2025
    python -m scripts.gee.drive.audit_drive_yearly_completeness --local

``--local`` revisa solo las rutas ``REPO_*`` del repositorio (útil sin red o tras ``download_drive_to_repo``).
"""
from __future__ import annotations

import argparse
import io
import re
import sys
from pathlib import Path

if __name__ == "__main__" and not __package__:
    _repo = Path(__file__).resolve().parents[2]
    _repo_str = str(_repo)
    if _repo_str not in sys.path:
        sys.path.insert(0, _repo_str)
    __package__ = "scripts.gee.drive"

from googleapiclient.http import MediaIoBaseDownload

from ..config import paths
from ..lib import yearmonth as ym_lib
from . import download_drive_to_repo
from .drive_audit import yearly_raster_present_in_drive


def _norm_exts(exts: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(e.lower() if e.startswith(".") else f".{e.lower()}" for e in exts)


def _geo_yearly_present(
    names: list[str],
    stem_prefix: str,
    year: int,
    extensions: tuple[str, ...],
) -> bool:
    exts = _norm_exts(extensions)
    tail = f"{stem_prefix}{year}"
    for n in names:
        base = Path(n).stem
        if base == tail or base.startswith(tail + "_"):
            if any(n.lower().endswith(e) for e in exts):
                return True
    return False


def _drive_csv_text(service, file_id: str, max_bytes: int = 4_000_000) -> str:
    request = service.files().get_media(fileId=file_id)
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    raw = buf.getvalue()[:max_bytes]
    return raw.decode("utf-8", errors="replace")


def _year_row_ok(text: str, year: int) -> tuple[bool, bool]:
    """
    Returns (found_year_line, value_looks_empty).
    """
    y = str(year)
    pat = re.compile(rf"^\s*{re.escape(y)}(?:\.0)?\s*[,;]", re.MULTILINE)
    for line in text.splitlines():
        if not pat.match(line):
            continue
        rest = pat.sub("", line, count=1).strip()
        if not rest:
            return True, True
        if rest in (",", ";"):
            return True, True
        return True, False
    return False, False


def _list_names_local(dir_path: Path) -> list[str]:
    if not dir_path.is_dir():
        return []
    return [p.name for p in dir_path.iterdir() if p.is_file()]


def _audit_drive(target_year: int) -> int:
    from .download_drive_to_repo import _find_folder_id, _list_files

    service = download_drive_to_repo.get_drive_service()
    exit_code = 0

    def folder_names(folder: str) -> list[str]:
        try:
            fid = _find_folder_id(service, folder)
            return [f.get("name") or "" for f in _list_files(service, fid)]
        except FileNotFoundError:
            print(f"  [FALTA] Carpeta Drive «{folder}» no existe.")
            return []

    def check_raster(label: str, folder: str, stem: str) -> None:
        nonlocal exit_code
        names = folder_names(folder)
        ok = yearly_raster_present_in_drive(
            [{"name": n} for n in names], f"{stem}{target_year}", (".tif", ".tiff")
        )
        status = "OK" if ok else "FALTA"
        if not ok:
            exit_code = 1
        print(f"  [{status}] {label} «{folder}» → {stem}{target_year}.tif")

    def check_geo(label: str, folder: str, stem_prefix: str) -> None:
        nonlocal exit_code
        names = folder_names(folder)
        ok = _geo_yearly_present(names, stem_prefix, target_year, (".geojson", ".json"))
        status = "OK" if ok else "FALTA"
        if not ok:
            exit_code = 1
        print(
            f"  [{status}] {label} «{folder}» → {stem_prefix}{target_year}.geojson"
        )

    def check_csv_in_folder(folder: str, csv_name: str, label: str) -> None:
        nonlocal exit_code
        try:
            fid = _find_folder_id(service, folder)
            files = _list_files(service, fid)
        except FileNotFoundError:
            print(f"  [FALTA] {label}: carpeta «{folder}» no existe.")
            exit_code = 1
            return
        match = next((f for f in files if (f.get("name") or "") == csv_name), None)
        if not match:
            print(f"  [FALTA] {label}: no está «{csv_name}» en «{folder}».")
            exit_code = 1
            return
        text = _drive_csv_text(service, match["id"])
        found, empty = _year_row_ok(text, target_year)
        if not found:
            print(
                f"  [FALTA] {label} «{csv_name}»: no hay fila de año {target_year}."
            )
            exit_code = 1
        elif empty:
            print(
                f"  [AVISO] {label} «{csv_name}»: año {target_year} presente pero valores vacíos."
            )
        else:
            print(f"  [OK] {label} «{csv_name}»: año {target_year} con datos.")

    print(f"Año objetivo: {target_year} (último año civil completo recomendado: "
          f"{ym_lib.last_completed_wall_clock_calendar_year()})\n")

    print("Rasters anuales")
    check_raster("NDVI", paths.DRIVE_RASTER_YEARLY, "NDVI_Yearly_")
    check_raster("AOD", paths.DRIVE_AOD_RASTER_YEARLY, "AOD_Yearly_")
    check_raster("NO2", paths.DRIVE_NO2_RASTER_YEARLY, "NO2_Yearly_")
    check_raster("SO2", paths.DRIVE_SO2_RASTER_YEARLY, "SO2_Yearly_")
    check_raster("LST", paths.DRIVE_LST_RASTER_YEARLY, "LST_Yearly_")
    check_raster("Huella", paths.DRIVE_HU_YEARLY, "Huella_Urbana_Yearly_")

    print("\nGeoJSON anuales (un archivo por año)")
    check_geo("NDVI barrios", paths.DRIVE_GEO_YEARLY_B, "NDVI_Yearly_ZonalStats_Barrios_")
    check_geo("NDVI manzanas", paths.DRIVE_GEO_YEARLY_M, "NDVI_Yearly_ZonalStats_Manzanas_")
    check_geo("AOD barrios", paths.DRIVE_AOD_GEO_YEARLY_B, "AOD_Yearly_ZonalStats_Barrios_")
    check_geo("AOD manzanas", paths.DRIVE_AOD_GEO_YEARLY_M, "AOD_Yearly_ZonalStats_Manzanas_")
    check_geo("NO2 barrios", paths.DRIVE_NO2_GEO_YEARLY_B, "NO2_Yearly_ZonalStats_Barrios_")
    check_geo("NO2 manzanas", paths.DRIVE_NO2_GEO_YEARLY_M, "NO2_Yearly_ZonalStats_Manzanas_")
    check_geo("SO2 barrios", paths.DRIVE_SO2_GEO_YEARLY_B, "SO2_Yearly_ZonalStats_Barrios_")
    check_geo("SO2 manzanas", paths.DRIVE_SO2_GEO_YEARLY_M, "SO2_Yearly_ZonalStats_Manzanas_")
    check_geo("LST barrios", paths.DRIVE_LST_GEO_YEARLY_B, "LST_Yearly_ZonalStats_Barrios_")
    check_geo("LST manzanas", paths.DRIVE_LST_GEO_YEARLY_M, "LST_Yearly_ZonalStats_Manzanas_")

    print("\nCSV anuales (tablas agregadas)")
    check_csv_in_folder(paths.DRIVE_CSV_YEARLY, "NDVI_y_av.csv", "NDVI áreas verdes")
    check_csv_in_folder(paths.DRIVE_CSV_YEARLY, "NDVI_y_urban.csv", "NDVI urbano")
    check_csv_in_folder(
        paths.DRIVE_CSV_YEARLY,
        "NDVI_y_zonal_barrios.csv",
        "NDVI anual zonal barrios (P25/P50/P75)",
    )
    check_csv_in_folder(paths.DRIVE_LST_CSV_YEARLY, "LST_y_urban.csv", "LST urbano")
    check_csv_in_folder(paths.DRIVE_HU_YEARLY, "Huella_Urbana_Anual.csv", "HU total ha")
    check_csv_in_folder(
        paths.DRIVE_HU_YEARLY, "Areas_Huella_Urbana_Yearly.csv", "HU áreas PRC"
    )

    print()
    return exit_code


def _audit_local(target_year: int) -> int:
    exit_code = 0
    ty = target_year

    def check_raster(label: str, dir_path: Path, stem: str) -> None:
        nonlocal exit_code
        names = _list_names_local(dir_path)
        ok = yearly_raster_present_in_drive(
            [{"name": n} for n in names], f"{stem}{ty}", (".tif", ".tiff")
        )
        st = "OK" if ok else "FALTA"
        if not ok:
            exit_code = 1
        print(f"  [{st}] {label} {dir_path} → {stem}{ty}.tif")

    def check_geo(label: str, dir_path: Path, stem_prefix: str) -> None:
        nonlocal exit_code
        names = _list_names_local(dir_path)
        ok = _geo_yearly_present(names, stem_prefix, ty, (".geojson", ".json"))
        st = "OK" if ok else "FALTA"
        if not ok:
            exit_code = 1
        print(f"  [{st}] {label} {dir_path}")

    def check_csv(path: Path, label: str) -> None:
        nonlocal exit_code
        if not path.is_file():
            print(f"  [FALTA] {label}: no existe {path}")
            exit_code = 1
            return
        text = path.read_text(encoding="utf-8", errors="replace")
        found, empty = _year_row_ok(text, ty)
        if not found:
            print(f"  [FALTA] {label}: sin fila año {ty} en {path}")
            exit_code = 1
        elif empty:
            print(f"  [AVISO] {label}: año {ty} sin valores en {path}")
        else:
            print(f"  [OK] {label}: año {ty} en {path.name}")

    print(f"[Modo local] Año objetivo: {ty}\n")
    print("Rasters anuales")
    check_raster("NDVI", paths.REPO_RASTER_NDVI_YEARLY, "NDVI_Yearly_")
    check_raster("AOD", paths.REPO_RASTER_AOD_YEARLY, "AOD_Yearly_")
    check_raster("NO2", paths.REPO_RASTER_NO2_YEARLY, "NO2_Yearly_")
    check_raster("SO2", paths.REPO_RASTER_SO2_YEARLY, "SO2_Yearly_")
    check_raster("LST", paths.REPO_RASTER_LST_YEARLY, "LST_Yearly_")
    check_raster("Huella", paths.REPO_RASTER_HU_YEARLY, "Huella_Urbana_Yearly_")

    print("\nGeoJSON anuales")
    check_geo("NDVI B", paths.REPO_GEOJSON_NDVI_YEARLY_B, "NDVI_Yearly_ZonalStats_Barrios_")
    check_geo("NDVI M", paths.REPO_GEOJSON_NDVI_YEARLY_M, "NDVI_Yearly_ZonalStats_Manzanas_")
    check_geo("AOD B", paths.REPO_GEOJSON_AOD_YEARLY_B, "AOD_Yearly_ZonalStats_Barrios_")
    check_geo("AOD M", paths.REPO_GEOJSON_AOD_YEARLY_M, "AOD_Yearly_ZonalStats_Manzanas_")
    check_geo("NO2 B", paths.REPO_GEOJSON_NO2_YEARLY_B, "NO2_Yearly_ZonalStats_Barrios_")
    check_geo("NO2 M", paths.REPO_GEOJSON_NO2_YEARLY_M, "NO2_Yearly_ZonalStats_Manzanas_")
    check_geo("SO2 B", paths.REPO_GEOJSON_SO2_YEARLY_B, "SO2_Yearly_ZonalStats_Barrios_")
    check_geo("SO2 M", paths.REPO_GEOJSON_SO2_YEARLY_M, "SO2_Yearly_ZonalStats_Manzanas_")
    check_geo("LST B", paths.REPO_GEOJSON_LST_YEARLY_B, "LST_Yearly_ZonalStats_Barrios_")
    check_geo("LST M", paths.REPO_GEOJSON_LST_YEARLY_M, "LST_Yearly_ZonalStats_Manzanas_")

    print("\nCSV anuales")
    check_csv(paths.REPO_CSV / "NDVI_y_av.csv", "NDVI_y_av")
    check_csv(paths.REPO_CSV / "NDVI_y_urban.csv", "NDVI_y_urban")
    check_csv(paths.REPO_CSV / "NDVI_y_zonal_barrios.csv", "NDVI_y_zonal_barrios")
    check_csv(paths.REPO_CSV_AOD / "AOD_y_urban.csv", "AOD_y_urban")
    check_csv(paths.REPO_CSV_NO2 / "NO2_y_urban.csv", "NO2_y_urban")
    check_csv(paths.REPO_CSV_SO2 / "SO2_y_urban.csv", "SO2_y_urban")
    check_csv(paths.REPO_CSV_LST / "LST_y_urban.csv", "LST_y_urban")
    check_csv(paths.REPO_CSV_HU / "Huella_Urbana_Anual.csv", "Huella_Urbana_Anual")
    check_csv(paths.REPO_CSV_HU / "Areas_Huella_Urbana_Yearly.csv", "Areas_Huella_Urbana_Yearly")

    print()
    return exit_code


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Auditar exports anuales en Drive (o copia local) hasta un año dado."
    )
    parser.add_argument(
        "--year",
        type=int,
        default=None,
        help="Año civil completo objetivo (default: último año cerrado UTC según yearmonth).",
    )
    parser.add_argument(
        "--local",
        action="store_true",
        help="Solo revisar rutas del repositorio, sin API de Drive.",
    )
    args = parser.parse_args()
    target = args.year if args.year is not None else ym_lib.last_completed_wall_clock_calendar_year()
    if args.local:
        code = _audit_local(target)
    else:
        code = _audit_drive(target)
    raise SystemExit(code)


if __name__ == "__main__":
    main()
