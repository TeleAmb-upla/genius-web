"""
Regenera el JSON del explorador LST zonal (solo barrios).

Se invoca desde ``download_drive_to_repo.run_drive_sync`` cuando alguna clave
``lst_csv_monthly`` / ``lst_csv_yearly`` está en la lista (sincronización de CSV LST
desde Drive hacia ``REPO_CSV``), análogo a NDVI con la clave ``csv``.
"""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_BUILD_SCRIPT = _PROJECT_ROOT / "scripts" / "repo" / "bundles" / "build_lst_zonal_explorer_bundle.py"


def refresh_lst_zonal_explorer_bundle(*, dry_run: bool = False) -> bool:
    """
    Ejecuta ``scripts/repo/bundles/build_lst_zonal_explorer_bundle.py``.

    Returns:
        True si el script terminó con código 0 o en dry-run.
    """
    if dry_run:
        print(
            "[LST] (dry-run) Se omitiría regeneración de LST_zonal_explorer_barrios.json"
        )
        return True
    if not _BUILD_SCRIPT.is_file():
        print(
            f"[LST] Aviso: no existe {_BUILD_SCRIPT.relative_to(_PROJECT_ROOT)}",
            file=sys.stderr,
        )
        return False
    print(
        "📊 LST: regenerando LST_zonal_explorer_barrios.json (tras CSV LST)…"
    )
    r = subprocess.run(
        [sys.executable, str(_BUILD_SCRIPT)],
        cwd=str(_PROJECT_ROOT),
        check=False,
    )
    if r.returncode != 0:
        print(
            "[LST] Error al regenerar el bundle del explorador zonal.",
            file=sys.stderr,
        )
        return False
    print("✓ LST: bundle explorador zonal actualizado.")
    return True
