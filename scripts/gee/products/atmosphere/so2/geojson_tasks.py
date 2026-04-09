"""SO2 GeoJSON tasks (delegación a atmosphere/tasks_core.py)."""
from __future__ import annotations

import ee

from ....drive.drive_export_gate import DriveExportGate
from ..spec import so2_spec
from .. import tasks_core as tc


def start_so2_geojson_tasks(
    *,
    drive_gate: DriveExportGate | None = None,
) -> list[ee.batch.Task]:
    """Encola exportaciones GeoJSON zonal (monthly/yearly/trend) para SO2."""
    return tc.start_geojson_tasks(so2_spec(), drive_gate=drive_gate)
