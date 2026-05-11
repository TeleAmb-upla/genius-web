"""Estado incremental LST (asset año–mes ``LST_YearMonth`` + derivados)."""
from __future__ import annotations

from pathlib import Path

from ...config import paths
from ...earth_engine_init import vectors
from ...lib import incremental_base as inc_base
from ...lib import incremental_plan as incplan
from ...lib import yearmonth as ym_lib
from .asset_bounds import lst_asset_min_year
from .constants import LST_ASSET_MIN_YEAR_FALLBACK

_manager = inc_base.IncrementalStateManager(
    state_filename="lst_export_state.json",
    root_asset_path=paths.ASSET_LST_YEARMONTH,
    start_year=LST_ASSET_MIN_YEAR_FALLBACK,
)


def state_path() -> Path:
    return _manager.state_path()


def list_missing_lst_yearmonth_months() -> list[tuple[int, int]]:
    """Meses civiles cerrados UTC aún no presentes en la ImageCollection ``LST_YearMonth``."""
    return ym_lib.list_missing_yearmonth_months(
        paths.ASSET_LST_YEARMONTH,
        start_year=lst_asset_min_year(),
    )


def plan_derivative_exports(
    *,
    missing_asset_months: list[tuple[int, int]],
    force_full: bool,
) -> incplan.DerivativePlan:
    return incplan.plan_derivative_exports(
        missing_asset_months=missing_asset_months,
        force_full=force_full,
        ic=vectors.lst_yearmonth_collection(),
        state_path=state_path(),
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
