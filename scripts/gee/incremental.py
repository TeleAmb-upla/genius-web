"""
Actualización incremental de exportaciones NDVI: solo derivados cuando la colección
`NDVI_YearMonth` tiene meses nuevos respecto al último ciclo guardado en disco.

Si aún faltan assets mensuales (huecos), solo se encolan tareas de asset; hay que
volver a ejecutar tras completarlas para generar rasters/CSV/GeoJSON actualizados.
"""
from __future__ import annotations

import datetime
import json
from dataclasses import dataclass
from pathlib import Path

import ee

from . import paths
from . import vectors

STATE_FILENAME = "ndvi_export_state.json"


def state_path() -> Path:
    return Path(__file__).resolve().parent / STATE_FILENAME


def load_last_processed_ym() -> tuple[int, int] | None:
    p = state_path()
    if not p.is_file():
        return None
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
        pair = data.get("last_derivative_ym")
        if pair and len(pair) == 2:
            return int(pair[0]), int(pair[1])
    except (OSError, json.JSONDecodeError, TypeError, ValueError):
        pass
    return None


def save_last_processed_ym(ym: tuple[int, int]) -> None:
    p = state_path()
    p.write_text(
        json.dumps({"last_derivative_ym": [ym[0], ym[1]]}, indent=2),
        encoding="utf-8",
    )


def list_missing_ndvi_yearmonth_months() -> list[tuple[int, int]]:
    """
    Meses (año, mes) que deberían existir en el asset (hasta el mes calendario actual
    excluido, igual que start_ndvi_ym_asset_tasks) y aún no están en la colección.
    """
    asset_path = paths.ASSET_NDVI_YEARMONTH
    saved = ee.ImageCollection(asset_path)

    def date_key_feat(img: ee.Image) -> ee.Feature:
        y = ee.Number(img.get("year")).format("%04d")
        m = ee.Number(img.get("month")).format("%02d")
        return ee.Feature(None, {"date_key": y.cat("-").cat(m)})

    existing = saved.map(date_key_feat).aggregate_array("date_key").getInfo() or []

    now = datetime.datetime.utcnow()
    current_year = now.year
    end_limit = datetime.datetime(current_year, now.month, 1)
    start_year = 2016

    missing: list[tuple[int, int]] = []
    for y in range(start_year, current_year + 1):
        for m in range(1, 13):
            cur = datetime.datetime(y, m, 1)
            if cur >= end_limit:
                break
            key = f"{y}-{m:02d}"
            if key not in existing:
                missing.append((y, m))
    return missing


def get_collection_max_ym(ic: ee.ImageCollection) -> tuple[int, int] | None:
    """Mayor (año, mes) presente en la colección (metadatos year/month)."""
    n = ic.size().getInfo()
    if n == 0:
        return None
    ymax = int(ee.Number(ic.aggregate_max("year")).getInfo())
    subset = ic.filter(ee.Filter.eq("year", ymax))
    mmax = int(ee.Number(subset.aggregate_max("month")).getInfo())
    return ymax, mmax


def _ym_le(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return a[0] < b[0] or (a[0] == b[0] and a[1] <= b[1])


def _ym_advance(y: int, m: int) -> tuple[int, int]:
    if m == 12:
        return y + 1, 1
    return y, m + 1


def new_months_since(
    last: tuple[int, int], max_ym: tuple[int, int]
) -> list[tuple[int, int]]:
    """Meses (y,m) con last < (y,m) <= max_ym (orden lexicográfico año-mes)."""
    out: list[tuple[int, int]] = []
    y, m = _ym_advance(last[0], last[1])
    while _ym_le((y, m), max_ym):
        out.append((y, m))
        y, m = _ym_advance(y, m)
    return out


@dataclass(frozen=True)
class DerivativePlan:
    """Qué exportaciones derivadas conviene encolar en esta ejecución."""

    run: bool
    reason: str
    max_ym: tuple[int, int] | None
    # None = todos los meses calendario con datos (misma semántica que antes).
    month_subset: frozenset[int] | None
    years_touched: frozenset[int]
    is_full_refresh: bool
    new_pairs: tuple[tuple[int, int], ...]


def plan_derivative_exports(
    *,
    missing_asset_months: list[tuple[int, int]],
    force_full: bool,
) -> DerivativePlan:
    ic = vectors.ndvi_yearmonth_collection()
    max_ym = get_collection_max_ym(ic)

    if missing_asset_months:
        return DerivativePlan(
            run=False,
            reason=(
                f"Hay {len(missing_asset_months)} mes(es) sin asset NDVI_YearMonth; "
                "completa esas tareas y vuelve a ejecutar para actualizar derivados."
            ),
            max_ym=max_ym,
            month_subset=None,
            years_touched=frozenset(),
            is_full_refresh=False,
            new_pairs=(),
        )

    if max_ym is None:
        return DerivativePlan(
            run=False,
            reason="La colección NDVI_YearMonth está vacía.",
            max_ym=None,
            month_subset=None,
            years_touched=frozenset(),
            is_full_refresh=False,
            new_pairs=(),
        )

    if force_full:
        return DerivativePlan(
            run=True,
            reason="Exportación completa (--force-full).",
            max_ym=max_ym,
            month_subset=None,
            years_touched=frozenset(),
            is_full_refresh=True,
            new_pairs=(),
        )

    last = load_last_processed_ym()
    if last is None:
        return DerivativePlan(
            run=True,
            reason="Primera ejecución con estado: se exportan todos los derivados.",
            max_ym=max_ym,
            month_subset=None,
            years_touched=frozenset(),
            is_full_refresh=True,
            new_pairs=(),
        )

    if _ym_le(max_ym, last):
        return DerivativePlan(
            run=False,
            reason=(
                f"Sin meses nuevos en la colección (último derivado procesado: "
                f"{last[0]}-{last[1]:02d}; máximo actual: {max_ym[0]}-{max_ym[1]:02d})."
            ),
            max_ym=max_ym,
            month_subset=None,
            years_touched=frozenset(),
            is_full_refresh=False,
            new_pairs=(),
        )

    pairs = new_months_since(last, max_ym)
    months = frozenset(m for _, m in pairs)
    years = frozenset(y for y, _ in pairs)
    return DerivativePlan(
        run=True,
        reason=(
            f"Datos nuevos: {len(pairs)} mes(es) entre {last[0]}-{last[1]:02d} "
            f"y {max_ym[0]}-{max_ym[1]:02d}."
        ),
        max_ym=max_ym,
        month_subset=months,
        years_touched=years,
        is_full_refresh=False,
        new_pairs=tuple(pairs),
    )
