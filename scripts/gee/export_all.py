"""
Encola exportaciones NDVI en Earth Engine (equivalente operativo a NDVI_export.txt).

**Actualización incremental (por defecto):** los derivados (raster Drive, CSV, GeoJSON
mensuales/SD/tendencia) solo se encolan si la colección `NDVI_YearMonth` tiene meses
nuevos respecto a `scripts/gee/ndvi_export_state.json`. Si faltan assets mensuales,
solo se encolan esas tareas: al terminar, vuelve a ejecutar para refrescar derivados.

Por defecto **no** encola la tendencia raster anual (`NDVI_Yearly_Trend`) ni los GeoJSON
zonales del último año (`NDVI_Yearly_ZonalStats_*`). Usa `--include-yearly` para
incluirlos cuando corresponda (solo si hay trabajo incremental o `--force-full`).

Uso (desde la raíz del repositorio, con credenciales EE configuradas):

    python -m scripts.gee.export_all
    python scripts/gee/export_all.py

    python -m scripts.gee.export_all --only asset,raster
    python -m scripts.gee.export_all --include-yearly
    python -m scripts.gee.export_all --force-full

Para encolar, esperar tareas a Drive y descargar al repo en un solo paso:

    python -m scripts.gee.pipeline
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

if __name__ == "__main__" and not __package__:
    _repo = Path(__file__).resolve().parents[2]
    _repo_str = str(_repo)
    if _repo_str not in sys.path:
        sys.path.insert(0, _repo_str)
    __package__ = "scripts.gee"

from .ee_init import initialize_ee
from .enqueue_exports import enqueue_ndvi_exports


def _parse_only(raw: str | None) -> set[str] | None:
    if not raw or raw.strip().lower() == "all":
        return None
    allowed = {
        "asset",
        "raster",
        "csv",
        "geojson",
    }
    parts = {p.strip().lower() for p in raw.split(",") if p.strip()}
    bad = parts - allowed
    if bad:
        print(
            f"Opciones --only no válidas: {bad}. Permitidas: {sorted(allowed)}",
            file=sys.stderr,
        )
        sys.exit(2)
    return parts


def main(argv: list[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Encolar exportaciones NDVI (GEE Python API).")
    parser.add_argument(
        "--only",
        default="all",
        help="Subconjunto separado por comas: asset,raster,csv,geojson (default: all).",
    )
    parser.add_argument(
        "--include-yearly",
        action="store_true",
        help=(
            "Incluye tendencia raster anual (NDVI_Yearly_Trend) y GeoJSON zonales anuales "
            "(NDVI_Yearly_ZonalStats_*). Por defecto se omiten."
        ),
    )
    parser.add_argument(
        "--force-full",
        action="store_true",
        help=(
            "Exporta todos los derivados aunque no haya meses nuevos (sigue sin encolar "
            "derivados si hay huecos pendientes en el asset NDVI_YearMonth)."
        ),
    )
    args = parser.parse_args(argv)
    only = _parse_only(args.only)
    skip_yearly = not args.include_yearly

    initialize_ee()

    result = enqueue_ndvi_exports(
        only=only,
        skip_yearly=skip_yearly,
        force_full=args.force_full,
    )
    plan = result.plan

    print(f"[incremental] {plan.reason}")
    if plan.max_ym:
        print(
            f"[incremental] Máximo (año-mes) en colección: "
            f"{plan.max_ym[0]}-{plan.max_ym[1]:02d}"
        )
    for line in result.messages:
        print(line)

    if result.state_saved and result.state_path_msg and plan.max_ym:
        print(
            f"[incremental] Estado actualizado: último derivado procesado hasta "
            f"{plan.max_ym[0]}-{plan.max_ym[1]:02d} ({result.state_path_msg})."
        )

    print("Listo: revisa las tareas en https://code.earthengine.google.com/tasks")


if __name__ == "__main__":
    main()
