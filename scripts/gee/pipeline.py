"""
Flujo unificado NDVI: (1) listar Drive y omitir exports EE si el archivo ya existe;
(2) encolar solo lo faltante; (3) esperar tareas a Drive; (4) listar Drive otra vez y
comparar con el repo local; (5) sincronizar Drive -> repositorio.

Las tareas de export a **Asset** no bloquean la descarga desde Drive.

Uso (desde la raíz del repositorio):

    python -m scripts.gee.pipeline
    python -m scripts.gee.pipeline --include-yearly
    python -m scripts.gee.pipeline --enqueue-only
    python -m scripts.gee.pipeline --download-only --sync-only all
    python -m scripts.gee.pipeline --dry-run-download
    python -m scripts.gee.pipeline --force-gee-export
    python -m scripts.gee.pipeline --skip-drive-preflight

    python scripts/gee/pipeline.py
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

from .download_drive_to_repo import get_drive_service, parse_sync_keys, run_drive_sync
from .drive_export_gate import DriveExportGate, report_drive_vs_local


def _parse_export_only(raw: str | None) -> set[str] | None:
    if not raw or raw.strip().lower() == "all":
        return None
    allowed = {"asset", "raster", "csv", "geojson"}
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
        description=(
            "Encolar export NDVI en Earth Engine, esperar tareas a Drive y sincronizar al repo local."
        )
    )
    parser.add_argument(
        "--only",
        default="all",
        help="Encolado: subconjunto asset,raster,csv,geojson (default: all).",
    )
    parser.add_argument(
        "--include-yearly",
        action="store_true",
        help="Incluye tendencia raster anual y GeoJSON zonales anuales.",
    )
    parser.add_argument(
        "--force-full",
        action="store_true",
        help="Exporta todos los derivados aunque no haya meses nuevos (salvo huecos en asset).",
    )
    parser.add_argument(
        "--enqueue-only",
        action="store_true",
        help="Solo encola en EE; no espera ni descarga.",
    )
    parser.add_argument(
        "--download-only",
        action="store_true",
        help="Solo descarga desde Drive (usa --sync-only o all). No encola.",
    )
    parser.add_argument(
        "--skip-wait",
        action="store_true",
        help="No espera a las tareas; descarga enseguida (riesgo de archivos incompletos).",
    )
    parser.add_argument(
        "--sync-only",
        default="all",
        help=(
            "Solo con --download-only: claves separadas por comas (igual que "
            "download_drive_to_repo --only) o all."
        ),
    )
    parser.add_argument(
        "--wait-timeout",
        type=float,
        default=0.0,
        metavar="SEC",
        help="Tiempo maximo de espera de tareas en segundos (0 = sin limite).",
    )
    parser.add_argument(
        "--poll",
        type=float,
        default=30.0,
        help="Segundos entre comprobaciones de estado de tareas (default: 30).",
    )
    parser.add_argument(
        "--dry-run-download",
        action="store_true",
        help="En la fase Drive a repo, solo lista lo que se descargaria (dry-run).",
    )
    parser.add_argument(
        "--full-sync-download",
        action="store_true",
        help="Forzar espejo completo al descargar (reemplaza archivos gestionados en local).",
    )
    parser.add_argument(
        "--incremental-download",
        action="store_true",
        help="Solo bajar archivos que falten en local (nunca borrar locales).",
    )
    parser.add_argument(
        "--force-gee-export",
        action="store_true",
        help="Encolar siempre las exportaciones EE aunque el archivo ya exista en Drive.",
    )
    parser.add_argument(
        "--skip-drive-preflight",
        action="store_true",
        help="No consultar Drive antes de encolar (equivale a desactivar la omisión por archivos existentes).",
    )
    args = parser.parse_args(argv)

    if args.enqueue_only and args.download_only:
        print("Use solo uno de --enqueue-only o --download-only.", file=sys.stderr)
        sys.exit(2)

    if args.full_sync_download and args.incremental_download:
        print(
            "Use solo uno de --full-sync-download o --incremental-download.",
            file=sys.stderr,
        )
        sys.exit(2)

    if args.download_only:
        try:
            keys = parse_sync_keys(args.sync_only)
        except ValueError as e:
            print(str(e), file=sys.stderr)
            sys.exit(2)
        dr_dl: bool | None
        if args.full_sync_download:
            dr_dl = True
        elif args.incremental_download:
            dr_dl = False
        else:
            dr_dl = None
        run_drive_sync(keys, dry_run=args.dry_run_download, full_replace=dr_dl)
        return

    from .ee_init import initialize_ee
    from .enqueue_exports import enqueue_ndvi_exports
    from .task_wait import wait_for_tasks

    only = _parse_export_only(args.only)
    skip_yearly = not args.include_yearly

    initialize_ee()

    use_gate = not args.force_gee_export and not args.skip_drive_preflight
    drive_service = None
    drive_gate = None
    if use_gate:
        print("Conectando a Google Drive (pre-flight: comprobar archivos ya exportados)…")
        drive_service = get_drive_service()
        drive_gate = DriveExportGate(drive_service, enabled=True)
    elif args.skip_drive_preflight:
        print("Pre-flight Drive omitido (--skip-drive-preflight).")

    result = enqueue_ndvi_exports(
        only=only,
        skip_yearly=skip_yearly,
        force_full=args.force_full,
        drive_gate=drive_gate,
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

    if args.enqueue_only:
        return

    drive_tasks = result.drive_tasks
    if drive_tasks:
        timeout = None if args.wait_timeout <= 0 else args.wait_timeout
        if args.skip_wait:
            print(
                "Aviso: --skip-wait: se continúa sin esperar a que las tareas terminen.",
                file=sys.stderr,
            )
        else:
            wait_for_tasks(
                drive_tasks,
                poll_seconds=args.poll,
                timeout_seconds=timeout,
            )
    else:
        print(
            "No se encolaron tareas nuevas a Drive (todo omitido en pre-flight o sin exports); "
            "se sigue con comprobación y descarga local si aplica."
        )

    sync_keys = sorted(result.sync_keys)

    if not sync_keys:
        print("No hay claves de sincronización; omitiendo descarga local.")
        return

    if drive_service is None:
        print("Conectando a Google Drive (post-export y comparación con local)…")
        drive_service = get_drive_service()
    if drive_gate is not None:
        drive_gate.invalidate()
    report_drive_vs_local(drive_service, sync_keys)

    print(f"Descargando hacia el repositorio: {', '.join(sync_keys)}")
    dr_dl2: bool | None
    if args.full_sync_download:
        dr_dl2 = True
    elif args.incremental_download:
        dr_dl2 = False
    else:
        dr_dl2 = None
    run_drive_sync(sync_keys, dry_run=args.dry_run_download, full_replace=dr_dl2)


if __name__ == "__main__":
    main()
