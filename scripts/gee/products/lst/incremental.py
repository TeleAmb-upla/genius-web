"""Estado incremental LST (asset anual LST_Yearly)."""
from __future__ import annotations

from pathlib import Path

from ...config import paths
from ...earth_engine_init import vectors
from ...lib import incremental_base as inc_base
from ...lib import incremental_plan as incplan
from ...lib import state as state_lib
from ...lib import yearmonth as ym_lib

_manager = inc_base.IncrementalStateManager(
    state_filename="lst_export_state.json",
    root_asset_path=paths.ASSET_LST_YEARLY,
    start_year=2013,
)


def state_path() -> Path:
    return _manager.state_path()


def list_missing_lst_yearly() -> list[int]:
    """Years not yet in the LST_Yearly asset collection."""
    return ym_lib.list_missing_yearly(paths.ASSET_LST_YEARLY, start_year=2013)


def plan_derivative_exports(
    *,
    missing_asset_years: list[int],
    force_full: bool,
) -> incplan.DerivativePlan:
    """
    Plan based on yearly assets. If years are missing, derivatives are blocked.
    Otherwise uses last_derivative_ym from state to decide delta.
    """
    if missing_asset_years:
        max_y = ym_lib.get_collection_max_year(vectors.lst_yearly_collection())
        max_ym = (max_y, 12) if max_y else None
        return incplan.DerivativePlan(
            run=False,
            reason=(
                f"Hay {len(missing_asset_years)} año(s) sin asset anual LST; "
                "completa esas tareas y vuelve a ejecutar para actualizar derivados."
            ),
            max_ym=max_ym,
            month_subset=None,
            years_touched=frozenset(),
            is_full_refresh=False,
            new_pairs=(),
        )

    ic = vectors.lst_yearly_collection()
    max_y = ym_lib.get_collection_max_year(ic)
    if max_y is None:
        return incplan.DerivativePlan(
            run=False,
            reason="La colección anual LST_Yearly está vacía.",
            max_ym=None,
            month_subset=None,
            years_touched=frozenset(),
            is_full_refresh=False,
            new_pairs=(),
        )

    max_ym = (max_y, 12)

    if force_full:
        return incplan.DerivativePlan(
            run=True,
            reason="Exportación completa (--force-full).",
            max_ym=max_ym,
            month_subset=None,
            years_touched=frozenset(),
            is_full_refresh=True,
            new_pairs=(),
        )

    last = incplan.load_last_processed_ym(state_path())
    if last is None:
        return incplan.DerivativePlan(
            run=True,
            reason="Primera ejecución con estado: se exportan todos los derivados.",
            max_ym=max_ym,
            month_subset=None,
            years_touched=frozenset(),
            is_full_refresh=True,
            new_pairs=(),
        )

    if ym_lib.ym_le(max_ym, last):
        return incplan.DerivativePlan(
            run=False,
            reason=(
                f"Sin datos nuevos (último derivado: {last[0]}-{last[1]:02d}; "
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
    return incplan.DerivativePlan(
        run=True,
        reason=(
            f"Datos nuevos: {len(pairs)} período(s) entre {last[0]}-{last[1]:02d} "
            f"y {max_ym[0]}-{max_ym[1]:02d}."
        ),
        max_ym=max_ym,
        month_subset=months,
        years_touched=years,
        is_full_refresh=False,
        new_pairs=tuple(pairs),
    )


def save_last_processed_ym(ym: tuple[int, int]) -> None:
    _manager.save_last_processed_ym(ym)


def load_last_trend_raster_full_year() -> int | None:
    return _manager.load_last_trend_raster_full_year()


def save_last_trend_raster_full_year(year: int) -> None:
    _manager.save_last_trend_raster_full_year(year)


def should_refresh_trend_raster(ic=None) -> bool:
    """True if the trend raster should be re-exported."""
    if ic is None:
        ic = vectors.lst_yearly_collection()
    max_y = ym_lib.get_collection_max_year(ic)
    if max_y is None:
        return False
    wall = ym_lib.last_completed_wall_clock_calendar_year()
    target = min(max_y, wall)
    saved = load_last_trend_raster_full_year()
    if saved is None:
        return True
    return target > saved
