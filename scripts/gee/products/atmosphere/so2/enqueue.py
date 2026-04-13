"""Encolar exportaciones SO2 (paridad operativa con AOD/LST/NDVI)."""
from __future__ import annotations

from ....drive.drive_audit import DriveFreshnessHints
from ....config.enqueue_types import EnqueueResult
from ....drive.drive_export_gate import DriveExportGate
from ..spec import so2_spec
from .. import enqueue as atmosphere_enqueue


def enqueue_so2_exports(
    *,
    only: set[str] | None = None,
    skip_yearly: bool = False,
    force_full: bool = False,
    drive_gate: DriveExportGate | None = None,
    drive_freshness: DriveFreshnessHints | None = None,
    tables_run_override: bool | None = None,
    persist_state: bool = True,
) -> EnqueueResult:
    """
    Encola todas las exportaciones SO2 (assets, rasters, CSV, GeoJSON).
    
    Delega a atmosphere/enqueue._enqueue_s5p() con spec SO2.
    """
    return atmosphere_enqueue._enqueue_s5p(
        so2_spec(),
        only=only,
        skip_yearly=skip_yearly,
        force_full=force_full,
        drive_gate=drive_gate,
        drive_freshness=drive_freshness,
        tables_run_override=tables_run_override,
        persist_state=persist_state,
        sync_prefix="so2",
    )
