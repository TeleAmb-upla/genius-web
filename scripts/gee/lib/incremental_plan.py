"""Plan de exportaciones derivadas (delta año-mes) reutilizable por producto."""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import ee

from . import state as state_lib
from . import yearmonth as ym_lib


@dataclass(frozen=True)
class DerivativePlan:
    run: bool
    reason: str
    max_ym: tuple[int, int] | None
    month_subset: frozenset[int] | None
    years_touched: frozenset[int]
    is_full_refresh: bool
    new_pairs: tuple[tuple[int, int], ...]


def load_last_processed_ym(state_path: Path) -> tuple[int, int] | None:
    pair = state_lib.read_state(state_path).get("last_derivative_ym")
    if pair and len(pair) == 2:
        try:
            return int(pair[0]), int(pair[1])
        except (TypeError, ValueError):
            pass
    return None


def save_last_processed_ym(state_path: Path, ym: tuple[int, int]) -> None:
    state_lib.merge_state(state_path, {"last_derivative_ym": [ym[0], ym[1]]})


def plan_derivative_exports(
    *,
    missing_asset_months: list[tuple[int, int]],
    force_full: bool,
    ic: ee.ImageCollection,
    state_path: Path,
) -> DerivativePlan:
    max_ym = ym_lib.get_collection_max_ym(ic)

    if missing_asset_months:
        return DerivativePlan(
            run=False,
            reason=(
                f"Hay {len(missing_asset_months)} mes(es) sin asset año-mes; "
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
            reason="La colección año-mes está vacía.",
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

    last = load_last_processed_ym(state_path)
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

    if ym_lib.ym_le(max_ym, last):
        return DerivativePlan(
            run=False,
            reason=(
                f"Sin meses nuevos (último derivado: {last[0]}-{last[1]:02d}; "
                f"máximo actual: {max_ym[0]}-{max_ym[1]:02d})."
            ),
            max_ym=max_ym,
            month_subset=None,
            years_touched=frozenset(),
            is_full_refresh=False,
            new_pairs=(),
        )

    pairs = ym_lib.new_months_since(last, max_ym)
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
