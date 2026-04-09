"""SO2 CSV tasks (delegación a atmosphere/tasks_core.py)."""
from __future__ import annotations

import ee

from ....drive.drive_export_gate import DriveExportGate
from ..spec import so2_spec
from .. import tasks_core as tc


def start_so2_csv_tasks(
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """Encola exportaciones CSV (monthly/yearly) para SO2."""
    return tc.start_csv_tasks(so2_spec(), drive_gate=drive_gate)
