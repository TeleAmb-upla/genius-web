"""
Tablas CSV AOD.

La serie urbana (Quilpué barrios) y el año–mes del visor se generan en el repo con
``scripts/repo/bundles/build_atm_urban_csv_from_barrios.py`` a partir de GeoJSON zonales y del
asset año–mes. No se exportan CSV «región» desde GEE: solo rasters y GeoJSON.

API estable vía ``../csv_tasks.py``.
"""
from __future__ import annotations

from .....drive.drive_export_gate import DriveExportGate


def start_aod_csv_tasks(
    ic=None,
    *,
    drive_gate: DriveExportGate | None = None,
) -> list:
    """AOD no encola export CSV a Drive (tablas urbanas = pipeline local)."""
    return []
