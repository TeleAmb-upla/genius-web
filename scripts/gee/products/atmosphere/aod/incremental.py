"""Estado incremental AOD (``aod_export_state.json``)."""
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
# Nota: Para AOD (en atmosphere/aod/), necesitamos subir 3 niveles para llegar a gee/
_manager = inc_base.IncrementalStateManager(
    state_filename="aod_export_state.json",
    root_asset_path=paths.ASSET_AOD_YEARMONTH,
    start_year=2001,
    state_root_path=Path(__file__).resolve().parents[3],  # scripts/gee/
)


def state_path() -> Path:
    return _manager.state_path()


def list_missing_aod_yearmonth_months() -> list[tuple[int, int]]:
    return ym_lib.list_missing_yearmonth_months(
        paths.ASSET_AOD_YEARMONTH,
        start_year=2001,
    )


def plan_derivative_exports(
    *,
    missing_asset_months: list[tuple[int, int]],
    force_full: bool,
) -> incplan.DerivativePlan:
    return incplan.plan_derivative_exports(
        missing_asset_months=missing_asset_months,
        force_full=force_full,
        ic=vectors.aod_yearmonth_collection(),
        state_path=state_path(),
    )


# Delegar a manager
def save_last_processed_ym(ym: tuple[int, int]) -> None:
    _manager.save_last_processed_ym(ym)


def load_last_trend_raster_full_year() -> int | None:
    return _manager.load_last_trend_raster_full_year()


def save_last_trend_raster_full_year(year: int) -> None:
    _manager.save_last_trend_raster_full_year(year)


def should_refresh_trend_raster(ic: ee.ImageCollection) -> bool:
    lfy = ym_lib.effective_yearly_export_year(ic)
    sy = load_last_trend_raster_full_year()
    if sy is None:
        return True
    return lfy > sy
