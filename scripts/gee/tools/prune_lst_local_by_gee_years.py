"""
Elimina en el repo artefactos LST acotados por año cuyo año no existe en la
ImageCollection ``LST_YearMonth`` (GEE). No borra climatología mensual (sin año
en el nombre) ni ``LST_Yearly_Trend.tif``.

Uso (desde la raíz del repositorio, con ``earthengine authenticate``):

    python -m scripts.gee.tools.prune_lst_local_by_gee_years
    python -m scripts.gee.tools.prune_lst_local_by_gee_years --dry-run
"""
from __future__ import annotations

import argparse
import csv
import re
import sys
from pathlib import Path

if __name__ == "__main__" and not __package__:
    _repo = Path(__file__).resolve().parents[3]
    _repo_str = str(_repo)
    if _repo_str not in sys.path:
        sys.path.insert(0, _repo_str)
    __package__ = "scripts.gee.tools"

import ee  # noqa: E402

from ..config import paths
from ..earth_engine_init.ee_init import initialize_ee
from ..earth_engine_init import vectors


_YEAR_RE = re.compile(r"_(\d{4})(?:\.[^.]+)?$")


def _stem_year(path: Path) -> int | None:
    m = _YEAR_RE.search(path.stem)
    if not m:
        return None
    return int(m.group(1))


def _filter_csv_by_year_column(
    csv_path: Path,
    valid_years: set[int],
    year_column: str,
    *,
    dry_run: bool,
) -> bool:
    if not csv_path.is_file():
        return False
    with csv_path.open(newline="", encoding="utf-8") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        return False
    if year_column not in rows[0]:
        return False
    kept = []
    removed = 0
    for row in rows:
        try:
            y = int(str(row.get(year_column, "")).strip())
        except ValueError:
            kept.append(row)
            continue
        if y in valid_years:
            kept.append(row)
        else:
            removed += 1
    if removed == 0:
        return False
    if dry_run:
        print(f"  [dry-run] {csv_path.name}: quitaría {removed} fila(s) (años fuera de GEE).")
        return True
    fieldnames = list(rows[0].keys())
    with csv_path.open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames)
        w.writeheader()
        w.writerows(kept)
    print(f"  {csv_path.name}: eliminadas {removed} fila(s).")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description="Poda artefactos LST locales vs años en GEE.")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Solo listar acciones sin borrar ni reescribir CSV.",
    )
    args = parser.parse_args()

    initialize_ee()
    ic = vectors.lst_yearmonth_collection()
    raw = ic.aggregate_array("year").distinct().getInfo() or []
    valid_years = {int(y) for y in raw}
    if not valid_years:
        print("La colección LST_YearMonth no devolvió años; abortando.")
        sys.exit(1)
    print(f"Años en GEE LST_YearMonth: {sorted(valid_years)}")

    deleted_files = 0

    def maybe_delete(p: Path) -> None:
        nonlocal deleted_files
        yr = _stem_year(p)
        if yr is None or yr in valid_years:
            return
        if args.dry_run:
            print(f"  [dry-run] eliminaría {p.relative_to(paths.PROJECT_ROOT)}")
        else:
            p.unlink(missing_ok=True)
            print(f"  eliminado {p.relative_to(paths.PROJECT_ROOT)}")
        deleted_files += 1

    for folder, pattern in (
        (paths.REPO_RASTER_LST_YEARLY, "LST_Yearly_*.tif"),
        (paths.REPO_GEOJSON_LST_SUHI_YEARLY, "LST_SUHI_Yearly_*.geojson"),
    ):
        if folder.is_dir():
            for p in folder.glob(pattern):
                maybe_delete(p)

    for folder in (
        paths.REPO_GEOJSON_LST_YEARLY_B,
        paths.REPO_GEOJSON_LST_YEARLY_M,
    ):
        if not folder.is_dir():
            continue
        for p in folder.glob("*.geojson"):
            if p.stem.startswith("Trend_"):
                continue
            maybe_delete(p)

    for name, col in (
        ("LST_y_urban.csv", "Year"),
        ("LST_y_zonal_barrios.csv", "Year"),
        ("LST_YearMonth_urban.csv", "Year"),
    ):
        _filter_csv_by_year_column(
            paths.REPO_CSV_LST / name,
            valid_years,
            col,
            dry_run=args.dry_run,
        )

    print(f"Listo. Archivos afectados (o simulados): {deleted_files}.")


if __name__ == "__main__":
    main()
