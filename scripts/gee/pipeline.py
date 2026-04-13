"""
Flujo unificado por producto: (1) plan incremental GEE (huecos asset); (2) auditoría
asset año-mes vs último mes civil cerrado UTC; (3) auditoría Drive por ``modifiedTime``
y anual según año civil cerrado reloj; (4) encolar derivados; (5) esperar; (6) comparar
Drive vs repo; (7) espejo local (``full_replace_keys``).

Por defecto en **dos fases**: asset+rasters (espera, incl. exports a Asset) y sync de
rasters; luego CSV+GeoJSON (espera y sync). Usa `--single-pass` para el flujo antiguo
(una sola tanda). Las tareas a **Asset** se esperan junto a la fase 1.

Rasters en Drive: ``NDVI_Yearly`` solo ``NDVI_Yearly_*.tif``; ``NDVI_Trend`` solo
``NDVI_Yearly_Trend.tif``. Con ``--include-yearly``, la tendencia se recalcula si hay
meses nuevos en el delta o un año civil completo nuevo (estado ``last_trend_raster_full_year``).

Uso (desde la raíz del repositorio):

    python -m scripts.gee.pipeline
    python -m scripts.gee.pipeline --single-pass
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

from .audit_terminal import (
    format_enqueue_message,
    print_audit_block,
    print_enqueue_counters,
    print_global_summary,
    print_product_summary_box,
)
from .earth_engine_init.ee_init import initialize_ee
from .earth_engine_init.task_wait import wait_for_tasks
from .drive.download_drive_to_repo import (
    SYNC_KEYS_RASTER_PHASE,
    SYNC_KEYS_TABLE_PHASE,
    get_drive_service,
    parse_sync_keys,
    run_drive_sync,
    sync_keys_for_export_categories,
)
from .drive.drive_audit import compute_drive_freshness_hints
from .drive.drive_export_gate import DriveExportGate, report_drive_vs_local
from .lib import yearmonth as ym_lib
from .products.lst.constants import LST_START_YEAR


PRODUCT_ORDER = ("ndvi", "aod", "no2", "so2", "lst", "hu")


def _parse_products(raw: str | None) -> list[str]:
    if not raw or not raw.strip():
        return list(PRODUCT_ORDER)  # Default: ejecuta todos
    s = raw.strip().lower()
    if s == "all":
        return list(PRODUCT_ORDER)
    allowed = set(PRODUCT_ORDER)
    if s not in allowed:
        print(
            f"--product no válido: {raw!r}. Use: {', '.join(PRODUCT_ORDER)} o all.",
            file=sys.stderr,
        )
        sys.exit(2)
    return [s]


def _plan_for_product(product: str, force_full: bool):
    if product == "ndvi":
        from .products.ndvi import incremental as inc

        missing = inc.list_missing_ndvi_yearmonth_months()
        plan = inc.plan_derivative_exports(
            missing_asset_months=missing,
            force_full=force_full,
        )
        return missing, plan
    if product == "aod":
        from .products.atmosphere.aod import incremental as inc

        missing = inc.list_missing_aod_yearmonth_months()
        plan = inc.plan_derivative_exports(
            missing_asset_months=missing,
            force_full=force_full,
        )
        return missing, plan
    if product == "lst":
        from .products.lst import incremental as inc

        missing_years = inc.list_missing_lst_yearly()
        plan = inc.plan_derivative_exports(
            missing_asset_years=missing_years,
            force_full=force_full,
        )
        return missing_years, plan
    if product == "no2":
        from .products.atmosphere.no2 import incremental as inc

        missing = inc.list_missing_no2_yearmonth_months()
        plan = inc.plan_derivative_exports(
            missing_asset_months=missing,
            force_full=force_full,
        )
        return missing, plan
    if product == "so2":
        from .products.atmosphere.so2 import incremental as inc

        missing = inc.list_missing_so2_yearmonth_months()
        plan = inc.plan_derivative_exports(
            missing_asset_months=missing,
            force_full=force_full,
        )
        return missing, plan
    if product == "hu":
        from .products.urban import incremental as inc
        from .lib import incremental_plan as incplan

        missing_years = inc.list_missing_hu_years()
        run = bool(missing_years) or force_full
        plan = incplan.DerivativePlan(
            run=run,
            reason=(
                f"{len(missing_years)} año(s) sin clasificar"
                if missing_years
                else "Huella Urbana al día."
            ),
            max_ym=None,
            month_subset=None,
            years_touched=frozenset(missing_years),
            is_full_refresh=force_full,
            new_pairs=(),
        )
        return missing_years, plan
    raise ValueError(product)


def _yearmonth_ic_for_product(product: str):
    """ImageCollection año-mes en GEE (asset) para auditoría y cobertura anual."""
    import ee

    from .earth_engine_init import vectors
    from .products.atmosphere.spec import no2_spec, so2_spec

    if product == "ndvi":
        return vectors.ndvi_yearmonth_collection()
    if product == "aod":
        return vectors.aod_yearmonth_collection()
    if product == "lst":
        return vectors.lst_yearly_collection()
    if product == "no2":
        return ee.ImageCollection(no2_spec().asset_ym)
    if product == "so2":
        return ee.ImageCollection(so2_spec().asset_ym)
    if product == "hu":
        return None
    raise ValueError(product)


def _enqueue_for_product(
    product: str,
    *,
    only: set[str] | None,
    skip_yearly: bool,
    force_full: bool,
    drive_gate,
    persist_state: bool,
    tables_run_override: bool | None = None,
    drive_freshness=None,
):
    kw: dict = dict(
        only=only,
        skip_yearly=skip_yearly,
        force_full=force_full,
        drive_gate=drive_gate,
        persist_state=persist_state,
        tables_run_override=tables_run_override,
        drive_freshness=drive_freshness,
    )
    if product == "ndvi":
        from .products.ndvi.enqueue import enqueue_ndvi_exports

        return enqueue_ndvi_exports(**kw)
    if product == "aod":
        from .products.atmosphere.aod.enqueue import enqueue_aod_exports

        return enqueue_aod_exports(**kw)
    if product == "lst":
        from .products.lst.enqueue import enqueue_lst_exports

        return enqueue_lst_exports(**kw)
    if product == "no2":
        from .products.atmosphere.no2.enqueue import enqueue_no2_exports

        return enqueue_no2_exports(**kw)
    if product == "so2":
        from .products.atmosphere.so2.enqueue import enqueue_so2_exports

        return enqueue_so2_exports(**kw)
    if product == "hu":
        from .products.urban.enqueue import enqueue_hu_exports

        return enqueue_hu_exports(**kw)
    raise ValueError(product)


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
            "Encolar exportaciones GEE (NDVI, AOD, NO2, SO2, LST), esperar tareas y sincronizar Drive → repo."
        )
    )
    parser.add_argument(
        "--product",
        default="all",
        metavar="ID",
        help=(
            "Producto: ndvi | aod | no2 | so2 | lst | all. "
            "Con «all» se ejecutan en ese orden (cada uno con el mismo --only / fases). "
            "Por defecto all (ejecuta todos)."
        ),
    )
    parser.add_argument(
        "--only",
        default="all",
        help="Encolado: subconjunto asset,raster,csv,geojson (default: all).",
    )
    parser.add_argument(
        "--include-yearly",
        action="store_true",
        help=(
            "Fuerza rasters anuales y GeoJSON zonales anuales aunque Drive ya los tenga. "
            "Sin esta bandera, los anuales se exportan automáticamente solo cuando "
            "la auditoría Drive detecta que faltan para el último año civil cerrado."
        ),
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
    parser.add_argument(
        "--single-pass",
        action="store_true",
        help=(
            "Encolar todo junto y una sola espera/descarga (comportamiento antiguo). "
            "Por defecto: fase 1 asset+rasters → espera y sync; fase 2 CSV+GeoJSON."
        ),
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

    only = _parse_export_only(args.only)
    skip_yearly = not args.include_yearly
    products = _parse_products(args.product)

    initialize_ee()

    use_gate = not args.force_gee_export and not args.skip_drive_preflight
    drive_service = None
    drive_gate = None
    if use_gate:
        print("📁 Verificando Google Drive (para evitar re-exportar archivos existentes)…")
        drive_service = get_drive_service()
        drive_gate = DriveExportGate(drive_service, enabled=True)
    elif args.skip_drive_preflight:
        print("⏭️  Omitiendo verificación de Drive (--skip-drive-preflight)")

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

    dr_dl2: bool | None
    if args.full_sync_download:
        dr_dl2 = True
    elif args.incremental_download:
        dr_dl2 = False
    else:
        dr_dl2 = None

    def _wait_and_sync(
        result,
        *,
        sync_keys_hint: set[str],
        only_for_fallback: set[str] | None,
        phase_label: str,
        product_tag: str,
    ) -> None:
        nonlocal drive_service, drive_gate
        pt = product_tag.upper()
        if result.messages:
            print_audit_block(f"📤 {pt} - {phase_label.title()}")
            for line in result.messages:
                print(format_enqueue_message(product_tag, line))
        
        rp = result.plan
        if result.state_saved and result.state_path_msg and rp.max_ym:
            print(
                f"✓ [{pt}] Estado guardado: {rp.max_ym[0]}-{rp.max_ym[1]:02d}"
            )
        
        if args.enqueue_only:
            print(f"✓ [{pt}] Tareas encoladas. Revisa: https://code.earthengine.google.com/tasks\n")
            return
        
        to_wait = list(result.asset_tasks) + list(result.drive_tasks)
        if to_wait:
            timeout = None if args.wait_timeout <= 0 else args.wait_timeout
            if args.skip_wait:
                print(
                    f"⏭️  [{pt}] Saltando espera (--skip-wait)…",
                    file=sys.stderr,
                )
            else:
                print_audit_block(f"⏳ {pt} - Esperando tareas en Earth Engine…")
                wait_for_tasks(
                    to_wait,
                    poll_seconds=args.poll,
                    timeout_seconds=timeout,
                    audit_prefix=f"[{pt}]",
                )
        else:
            print(f"ℹ️  [{pt}] No hay tareas nuevas para esta fase.")
        
        sync_keys = sorted(k for k in result.sync_keys if k in sync_keys_hint)
        if not sync_keys:
            print(f"ℹ️  [{pt}] Nada que descargar.")
            return
        
        if drive_service is None:
            print("📁 Conectando a Google Drive…")
            drive_service = get_drive_service()
        
        if drive_gate is not None:
            drive_gate.invalidate()
        
        print_audit_block(f"⬇️  {pt} - Descargando desde Drive a repositorio")
        report_drive_vs_local(drive_service, sync_keys, product=product_tag)
        
        mirror_keys = frozenset(
            k for k in result.sync_full_mirror_keys if k in sync_keys
        )
        if mirror_keys:
            print(
                f"🔄 [{pt}] Reemplazando locales (mirror completo): "
                f"{', '.join(sorted(mirror_keys))}"
            )
        
        print(f"📥 [{pt}] Descargando: {', '.join(sync_keys)}…")
        run_drive_sync(
            sync_keys,
            dry_run=args.dry_run_download,
            full_replace=dr_dl2,
            full_replace_keys=mirror_keys,
            audit_product=product_tag,
        )
        print(f"✓ [{pt}] Descarga completada.\n")

    all_results: dict[str, object] = {}

    for product in products:
        print_audit_block(f"🔄 {product.upper()}")
        _missing_assets, plan = _plan_for_product(product, args.force_full)
        print_product_summary_box(
            product,
            plan_reason=plan.reason,
            max_ym=plan.max_ym,
        )

        ic_audit = _yearmonth_ic_for_product(product)
        if product == "hu":
            print(f"  [GEE audit HU] Clasificación local; sin asset central.")
        elif product == "lst":
            for line in ym_lib.audit_asset_yearly_vs_wall_clock_messages(
                ic_audit, product=product
            ):
                print(f"  {line}")
        else:
            for line in ym_lib.audit_asset_yearmonth_vs_wall_clock_messages(
                ic_audit, product=product
            ):
                print(f"  {line}")

        drive_freshness = None
        if use_gate and drive_service is not None and ic_audit is not None:
            if product == "lst":
                max_y = ym_lib.get_collection_max_year(ic_audit)
                max_ym = (max_y, 12) if max_y else None
            else:
                max_ym = ym_lib.get_collection_max_ym(ic_audit)
            ty_wall = ym_lib.last_completed_wall_clock_calendar_year()
            cover = ym_lib.assets_cover_full_calendar_year(max_ym, ty_wall)
            avail_years = ym_lib.get_collection_distinct_years(
                ic_audit, max_year=ty_wall,
            )
            if product == "lst":
                avail_years = [y for y in avail_years if y >= LST_START_YEAR]
            drive_freshness = compute_drive_freshness_hints(
                product,
                drive_service,
                target_yearly_year=ty_wall,
                assets_cover_target_year=cover,
                available_years=avail_years,
            )
            for line in drive_freshness.audit_messages:
                print(f"  {line}")

        if use_phased:
            print(
                "\n=== Fase 1: asset + rasters (Earth Engine → Drive; luego sync local) ===\n"
            )
            r1 = _enqueue_for_product(
                product,
                only=phase1_only,
                skip_yearly=skip_yearly,
                force_full=args.force_full,
                drive_gate=drive_gate,
                persist_state=False,
                tables_run_override=None,
                drive_freshness=drive_freshness,
            )
            print_enqueue_counters(r1)
            _wait_and_sync(
                r1,
                sync_keys_hint=SYNC_KEYS_RASTER_PHASE,
                only_for_fallback=phase1_only,
                phase_label="Fase 1",
                product_tag=product,
            )
            force_yearly_tables = bool(
                drive_freshness and drive_freshness.yearly_tables_missing_or_stale
            )
            force_yearly_raster = bool(
                drive_freshness and drive_freshness.yearly_raster_missing_or_stale
            )
            phase2_needed = (
                plan.run
                or force_yearly_tables
                or force_yearly_raster
            )
            if phase2_needed:
                reasons = []
                if plan.run:
                    reasons.append("datos nuevos en fuente GEE")
                if force_yearly_tables:
                    reasons.append("tablas anuales faltan o tienen datos inválidos")
                if force_yearly_raster:
                    n_missing = len(drive_freshness.missing_yearly_raster_years) if drive_freshness else 0
                    reasons.append(f"faltan {n_missing} raster(s) anual(es) en Drive")
                print(
                    f"  [Fase 2 activa] Razón: {'; '.join(reasons)}."
                )
            else:
                print("  [Fase 2] Sin cambios necesarios en tablas/GeoJSON.")
            print(
                "\n=== Fase 2: CSV + GeoJSON (tras rasters; luego sync local) ===\n"
            )
            r2 = _enqueue_for_product(
                product,
                only=phase2_only,
                skip_yearly=skip_yearly,
                force_full=args.force_full,
                drive_gate=drive_gate,
                persist_state=True,
                tables_run_override=None,
                drive_freshness=drive_freshness,
            )
            print_enqueue_counters(r2)
            _wait_and_sync(
                r2,
                sync_keys_hint=SYNC_KEYS_TABLE_PHASE,
                only_for_fallback=phase2_only,
                phase_label="Fase 2",
                product_tag=product,
            )
            all_results[product] = r2
            continue

        result = _enqueue_for_product(
            product,
            only=only,
            skip_yearly=skip_yearly,
            force_full=args.force_full,
            drive_gate=drive_gate,
            persist_state=True,
            tables_run_override=None,
            drive_freshness=drive_freshness,
        )
        print_enqueue_counters(result)
        _wait_and_sync(
            result,
            sync_keys_hint=set(SYNC_KEYS_RASTER_PHASE | SYNC_KEYS_TABLE_PHASE),
            only_for_fallback=only,
            phase_label="Pipeline",
            product_tag=product,
        )
        all_results[product] = result

    if all_results:
        print_global_summary(all_results)


if __name__ == "__main__":
    main()
