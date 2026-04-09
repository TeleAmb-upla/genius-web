"""Estado incremental SO2 (``so2_export_state.json``)."""
from __future__ import annotations

from pathlib import Path

import ee

from ....config import paths
from ....earth_engine_init import vectors
from ....lib import incremental_base as inc_base
from ....lib import incremental_plan as incplan
from ....lib import state as state_lib
from ....lib import yearmonth as ym_lib

# Instancia de manager
_manager = inc_base.IncrementalStateManager(
    state_filename="so2_export_state.json",
    root_asset_path=paths.ASSET_SO2_YEARMONTH,
    start_year=2019,
    state_root_path=Path(__file__).resolve().parents[3],  # scripts/gee/
)


def state_path() -> Path:
    return _manager.state_path()


def list_missing_so2_yearmonth_months() -> list[tuple[int, int]]:
    return ym_lib.list_missing_yearmonth_months(
        paths.ASSET_SO2_YEARMONTH,
        start_year=2019,
    )


def plan_derivative_exports(
    *,
    missing_asset_months: list[tuple[int, int]],
    force_full: bool,
) -> incplan.DerivativePlan:
    # SO2 no tiene access directo a collection desde vectors.py,
    # usar spec + asset path directo
    ic = ee.ImageCollection(paths.ASSET_SO2_YEARMONTH)
    return incplan.plan_derivative_exports(
        missing_asset_months=missing_asset_months,
        force_full=force_full,
        ic=ic,
        state_path=state_path(),
    )


# Delegar a manager
def save_last_processed_ym(ym: tuple[int, int]) -> None:
    _manager.save_last_processed_ym(ym)


def load_last_trend_raster_full_year() -> int | None:
    return _manager.load_last_trend_raster_full_year()


def save_last_trend_raster_full_year(year: int) -> None:
    _manager.save_last_trend_raster_full_year(year)
