"""
Registro único de productos para ``pipeline`` y ``export_all``.

Orden de ``PRODUCT_ORDER`` y la lógica de plan/encolado son las mismas que antes vivían
en ``pipeline.py``; aquí solo se centraliza el *dispatch* por variable.

**Extracción hacia Drive (raster / GeoJSON / CSV compartido):** los productos
``ndvi``, ``aod``, ``lst``, ``no2`` y ``so2`` encolan derivados vía sus
``enqueue_*`` → ``linear/*``, que a su vez usan ``lib.unified_product_extraction``
(y ``lib.derivative_raster_export`` para medianas mensual/anual desde IC año-mes).
``hu`` (huella) no entra en esa capa. Tras ``initialize_ee()``, el pipeline llama
``warm_unified_extraction_layer()`` para fallar pronto si falta el módulo o hay
error de importación.
"""
from __future__ import annotations

import sys


PRODUCT_ORDER = ("ndvi", "aod", "no2", "so2", "lst", "hu")


def warm_unified_extraction_layer() -> None:
    """Importa la capa compartida de exports a Drive (detección temprana de roturas)."""
    from ..lib import derivative_raster_export  # noqa: F401
    from ..lib import unified_product_extraction  # noqa: F401


def _parse_products(raw: str | None) -> list[str]:
    if not raw or not raw.strip():
        return list(PRODUCT_ORDER)
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
        from .ndvi import incremental as inc

        missing = inc.list_missing_ndvi_yearmonth_months()
        plan = inc.plan_derivative_exports(
            missing_asset_months=missing,
            force_full=force_full,
        )
        return missing, plan
    if product == "aod":
        from .atmosphere.aod import incremental as inc

        missing = inc.list_missing_aod_yearmonth_months()
        plan = inc.plan_derivative_exports(
            missing_asset_months=missing,
            force_full=force_full,
        )
        return missing, plan
    if product == "lst":
        from .lst import incremental as inc

        missing = inc.list_missing_lst_yearmonth_months()
        plan = inc.plan_derivative_exports(
            missing_asset_months=missing,
            force_full=force_full,
        )
        return missing, plan
    if product == "no2":
        from .atmosphere.no2 import incremental as inc

        missing = inc.list_missing_no2_yearmonth_months()
        plan = inc.plan_derivative_exports(
            missing_asset_months=missing,
            force_full=force_full,
        )
        return missing, plan
    if product == "so2":
        from .atmosphere.so2 import incremental as inc

        missing = inc.list_missing_so2_yearmonth_months()
        plan = inc.plan_derivative_exports(
            missing_asset_months=missing,
            force_full=force_full,
        )
        return missing, plan
    if product == "hu":
        from .urban import incremental as inc
        from ..lib import incremental_plan as incplan

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

    from ..earth_engine_init import vectors
    from .atmosphere.spec import no2_spec, so2_spec

    if product == "ndvi":
        return vectors.ndvi_yearmonth_collection()
    if product == "aod":
        return vectors.aod_yearmonth_collection()
    if product == "lst":
        return vectors.lst_yearmonth_collection()
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
        from .ndvi.enqueue import enqueue_ndvi_exports

        return enqueue_ndvi_exports(**kw)
    if product == "aod":
        from .atmosphere.aod.enqueue import enqueue_aod_exports

        return enqueue_aod_exports(**kw)
    if product == "lst":
        from .lst.enqueue import enqueue_lst_exports

        return enqueue_lst_exports(**kw)
    if product == "no2":
        from .atmosphere.no2.enqueue import enqueue_no2_exports

        return enqueue_no2_exports(**kw)
    if product == "so2":
        from .atmosphere.so2.enqueue import enqueue_so2_exports

        return enqueue_so2_exports(**kw)
    if product == "hu":
        from .urban.enqueue import enqueue_hu_exports

        return enqueue_hu_exports(**kw)
    raise ValueError(product)
