"""NO2 raster tasks (delegación a atmosphere/tasks_core.py)."""
from __future__ import annotations

import ee

from ....drive.drive_export_gate import DriveExportGate
from ..spec import no2_spec
from .. import tasks_core as tc


def start_no2_ym_asset_tasks() -> list[ee.batch.Task]:
    """Encola assets año-mes para NO2."""
    return tc.start_ym_asset_tasks(no2_spec())


def start_no2_monthly_raster_tasks(
    *,
    month_numbers: frozenset[int] | None = None,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """Encola rasters mensuales para NO2."""
    return tc.start_monthly_raster_tasks(
        no2_spec(),
        month_numbers=month_numbers,
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
    )


def start_no2_yearly_raster_tasks(
    *,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> list[ee.batch.Task]:
    """Encola rasters anuales para NO2."""
    return tc.start_yearly_raster_tasks(
        no2_spec(),
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
    )


def start_no2_trend_raster_task(
    *,
    drive_gate: DriveExportGate | None = None,
    bypass_drive_gate: bool = False,
) -> ee.batch.Task | None:
    """Encola raster de tendencia para NO2."""
    return tc.start_trend_raster_task(
        no2_spec(),
        drive_gate=drive_gate,
        bypass_drive_gate=bypass_drive_gate,
    )
