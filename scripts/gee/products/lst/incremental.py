"""Estado incremental LST."""
from __future__ import annotations

from pathlib import Path

import ee

from ... import paths
from ... import vectors
from ...lib import incremental_plan as incplan
from ...lib import state as state_lib
from ...lib import yearmonth as ym_lib

STATE_FILENAME = "lst_export_state.json"


def state_path() -> Path:
    return Path(__file__).resolve().parents[2] / STATE_FILENAME


def list_missing_lst_yearmonth_months() -> list[tuple[int, int]]:
    return ym_lib.list_missing_yearmonth_months(paths.ASSET_LST_YEARMONTH, start_year=2013)


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
    incplan.save_last_processed_ym(state_path(), ym)


def last_full_calendar_year_from_lst(ic: ee.ImageCollection) -> int:
    return ym_lib.last_full_calendar_year_from_yearmonth_ic(ic)


def load_last_trend_raster_full_year() -> int | None:
    v = state_lib.read_state(state_path()).get("last_trend_raster_full_year")
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def save_last_trend_raster_full_year(year: int) -> None:
    state_lib.merge_state(state_path(), {"last_trend_raster_full_year": year})


def should_refresh_trend_raster(ic: ee.ImageCollection) -> bool:
    lfy = ym_lib.effective_yearly_export_year(ic)
    sy = load_last_trend_raster_full_year()
    if sy is None:
        return True
    return lfy > sy
