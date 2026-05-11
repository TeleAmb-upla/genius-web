"""
Regenera los JSON del explorador zonal de calidad del aire (barrios: AOD, NO₂, SO₂).

Se invoca desde ``download_drive_to_repo.run_drive_sync`` cuando se sincronizan
GeoJSON o CSV ATM relevantes (misma idea que NDVI/LST).
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_BUILD_SCRIPT = _PROJECT_ROOT / "scripts" / "repo" / "bundles" / "build_atm_zonal_explorer_bundle.py"


def refresh_atm_zonal_explorer_bundle(*, dry_run: bool = False) -> bool:
    if dry_run:
        print(
            "[ATM] (dry-run) Se omitiría regeneración de "
            "AOD/NO2/SO2_zonal_explorer_barrios.json"
        )
        return True
    if not _BUILD_SCRIPT.is_file():
        print(
            f"[ATM] Aviso: no existe {_BUILD_SCRIPT.relative_to(_PROJECT_ROOT)}",
            file=sys.stderr,
        )
        return False
    print(
        "📊 ATM: regenerando bundles explorador zonal (AOD, NO₂, SO₂)…",
    )
    r = subprocess.run(
        [sys.executable, str(_BUILD_SCRIPT)],
        cwd=str(_PROJECT_ROOT),
        check=False,
    )
    if r.returncode != 0:
        print(
            "[ATM] Error al regenerar bundles del explorador zonal.",
            file=sys.stderr,
        )
        return False
    print("✓ ATM: bundles explorador zonal actualizados.")
    return True
