"""
Encola exportaciones NDVI en Earth Engine (equivalente operativo a NDVI_export.txt).

**Actualización incremental (por defecto):** los derivados siguen `ndvi_export_state.json`;
los rasters anuales en Drive solo se encolan si faltan allí (pre-flight en `pipeline`).
La climatología mensual se refresca además cuando el último .tif local es de otro año
que el año del último mes disponible en la colección.

Por defecto **no** encola tendencia raster ni GeoJSON zonales anuales. Con
``--include-yearly``: tendencia raster ``NDVI_Yearly_Trend.tif`` → carpeta Drive
``NDVI_Trend`` (repo ``NDVI_Trend/``); compuestos ``NDVI_Yearly_YYYY.tif`` → Drive
``NDVI_Yearly``. La tendencia se vuelve a calcular si hay meses nuevos en el delta **o**
un año civil completo nuevo (véase ``last_trend_raster_full_year`` en el estado JSON).

Sin `--single-pass`, el encolado va en dos tandas (rasters primero, luego CSV+GeoJSON);
Earth Engine puede paralelizar, pero el **orden estricto espera/sync** está en `pipeline`.

Uso (desde la raíz del repositorio, con credenciales EE configuradas):

    python -m scripts.gee.export_all
    python -m scripts.gee.export_all --single-pass
    python -m scripts.gee.export_all --only asset,raster
    python -m scripts.gee.export_all --include-yearly
    python -m scripts.gee.export_all --force-full

Para pre-flight Drive, esperar tareas y descarga al repo en fases: `python -m scripts.gee.pipeline`
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

from .audit_terminal import format_enqueue_message, print_audit_block
from .earth_engine_init.ee_init import initialize_ee
from .pipeline import _enqueue_for_product, _parse_products, _plan_for_product


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
    parser = argparse.ArgumentParser(
        description="Encolar exportaciones GEE por producto (sin espera ni descarga Drive)."
    )
    parser.add_argument(
        "--product",
        default="ndvi",
        metavar="ID",
        help="ndvi | aod | no2 | so2 | lst | all (default: ndvi).",
    )
    parser.add_argument(
        "--only",
        default="all",
        help="Subconjunto separado por comas: asset,raster,csv,geojson (default: all).",
    )
    parser.add_argument(
        "--include-yearly",
        action="store_true",
        help=(
            "Incluye tendencia raster (Drive NDVI_Trend/), anuales NDVI_Yearly_*.tif (Drive "
            "NDVI_Yearly/) y GeoJSON zonales anuales. La tendencia raster se recalcula también "
            "cuando aparece un año civil completo nuevo en la colección."
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
    parser.add_argument(
        "--single-pass",
        action="store_true",
        help="Encola todo en una sola llamada (sin separar rasters y tablas).",
    )
    args = parser.parse_args(argv)
    only = _parse_only(args.only)
    skip_yearly = not args.include_yearly
    products = _parse_products(args.product)

    initialize_ee()

    p1_names = frozenset({"asset", "raster"})
    p2_names = frozenset({"csv", "geojson"})
    if only is None:
        phase1_only: set[str] | None = set(p1_names)
        phase2_only: set[str] | None = set(p2_names)
    else:
        phase1_only = only & p1_names
        phase2_only = only & p2_names

    use_phased = (
        not args.single_pass
        and bool(phase1_only)
        and bool(phase2_only)
    )

    for product in products:
        print_audit_block(f"export_all · {product.upper()} · solo encolado (sin espera ni Drive)")
        _, plan = _plan_for_product(product, args.force_full)
        print(f"[incremental {product}] {plan.reason}")
        if plan.max_ym:
            print(
                f"[incremental {product}] Máximo (año-mes) en colección: "
                f"{plan.max_ym[0]}-{plan.max_ym[1]:02d}"
            )

        if use_phased:
            print_audit_block(
                f"export_all · {product.upper()} · Fase 1: asset + rasters"
            )
            r1 = _enqueue_for_product(
                product,
                only=phase1_only,
                skip_yearly=skip_yearly,
                force_full=args.force_full,
                drive_gate=None,
                persist_state=False,
                tables_run_override=None,
            )
            for line in r1.messages:
                print(format_enqueue_message(product, line))
            phase1_work = bool(r1.asset_tasks or r1.drive_tasks)
            tables_override = plan.run or phase1_work
            print_audit_block(
                f"export_all · {product.upper()} · Fase 2: CSV + GeoJSON"
            )
            result = _enqueue_for_product(
                product,
                only=phase2_only,
                skip_yearly=skip_yearly,
                force_full=args.force_full,
                drive_gate=None,
                persist_state=True,
                tables_run_override=tables_override,
            )
        else:
            print_audit_block(
                f"export_all · {product.upper()} · encolado (una sola pasada)"
            )
            result = _enqueue_for_product(
                product,
                only=only,
                skip_yearly=skip_yearly,
                force_full=args.force_full,
                drive_gate=None,
                persist_state=True,
                tables_run_override=None,
            )

        for line in result.messages:
            print(format_enqueue_message(product, line))

        rp = result.plan
        if result.state_saved and result.state_path_msg and rp.max_ym:
            print(
                f"[incremental {product}] Estado actualizado: último derivado procesado hasta "
                f"{rp.max_ym[0]}-{rp.max_ym[1]:02d} ({result.state_path_msg})."
            )

        print(
            f"[{product.upper()}] Listo: revisa las tareas en "
            "https://code.earthengine.google.com/tasks"
        )


if __name__ == "__main__":
    main()
