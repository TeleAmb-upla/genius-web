"""
Regenera el JSON del explorador NDVI zonal (solo barrios).

Se invoca desde ``download_drive_to_repo.run_drive_sync`` cuando la clave ``csv`` está
en la lista: sincroniza CSV NDVI desde Drive (carpetas ``NDVI_Monthly`` y ``NDVI_Yearly``),
incluidos ``NDVI_m_zonal_*``, ``NDVI_y_zonal_*``, ``NDVI_y_urban``, etc., hacia ``REPO_CSV``.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_BUILD_SCRIPT = _PROJECT_ROOT / "scripts" / "repo" / "bundles" / "build_ndvi_zonal_explorer_bundle.py"


def refresh_ndvi_zonal_explorer_bundle(*, dry_run: bool = False) -> bool:
    """
    Ejecuta ``scripts/repo/bundles/build_ndvi_zonal_explorer_bundle.py``.

    Returns:
        True si el script terminó con código 0 o en dry-run.
    """
    if dry_run:
        print(
            "[NDVI] (dry-run) Se omitiría regeneración de NDVI_zonal_explorer_barrios.json"
        )
        return True
    if not _BUILD_SCRIPT.is_file():
        print(
            f"[NDVI] Aviso: no existe {_BUILD_SCRIPT.relative_to(_PROJECT_ROOT)}",
            file=sys.stderr,
        )
        return False
    print(
        "📊 NDVI: regenerando NDVI_zonal_explorer_barrios.json (tras CSV mensual)…"
    )
    r = subprocess.run(
        [sys.executable, str(_BUILD_SCRIPT)],
        cwd=str(_PROJECT_ROOT),
        check=False,
    )
    if r.returncode != 0:
        print(
            "[NDVI] Error al regenerar el bundle del explorador zonal.",
            file=sys.stderr,
        )
        return False
    print("✓ NDVI: bundle explorador zonal actualizado.")
    return True
