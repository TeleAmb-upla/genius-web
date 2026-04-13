"""Incremental state for Huella Urbana yearly classification."""
from __future__ import annotations

import datetime
from pathlib import Path

from ...config import paths
from ...lib import state as state_lib
from ...lib import yearmonth as ym_lib

START_YEAR = 2019
END_YEAR_RANGE = None

STATE_PATH = Path(__file__).resolve().parents[2] / "hu_export_state.json"


def state_path() -> Path:
    return STATE_PATH


def _target_last_year() -> int:
    """Last year that is fully classifiable (Jan-Mar data available → previous year)."""
    now = datetime.datetime.utcnow()
    if now.month >= 4:
        return now.year
    return now.year - 1


def list_missing_hu_years() -> list[int]:
    """Years not yet exported (by checking local rasters)."""
    target = _target_last_year()
    existing: set[int] = set()
    raster_dir = paths.REPO_RASTER_HU_YEARLY
    if raster_dir.is_dir():
        for p in raster_dir.iterdir():
            if p.suffix.lower() in (".tif", ".tiff") and p.name.startswith(
                "Huella_Urbana_Yearly_"
            ):
                try:
                    year_str = p.stem.split("_")[-1]
                    existing.add(int(year_str))
                except (ValueError, IndexError):
                    pass
    return [y for y in range(START_YEAR, target + 1) if y not in existing]


def save_last_year(year: int) -> None:
    state_lib.merge_state(STATE_PATH, {"last_hu_year": year})


def load_last_year() -> int | None:
    v = state_lib.read_state(STATE_PATH).get("last_hu_year")
    try:
        return int(v) if v is not None else None
    except (TypeError, ValueError):
        return None
