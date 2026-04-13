"""
Auditoría local de assets GEE (misma lógica que el pipeline).

No envíe credenciales a nadie: ejecute en su máquina tras `earthengine authenticate`.

Desde la raíz del repositorio:

    python -m scripts.gee.audit_gee_assets

Imprime:
  - Objetivo de reloj UTC (último mes civil cerrado, último año civil cerrado).
  - Para cada ImageCollection año-mes (NDVI, AOD, NO2, SO2): máximo (year, month),
    año anual efectivo (`effective_yearly_export_year`) y mensajes de auditoría.
  - Para colecciones anuales (LST, Huella): máximo `year` vs objetivo.

Requiere: earthengine-api, acceso de lectura a los assets del proyecto.
"""
from __future__ import annotations

import argparse
import importlib
import sys
from pathlib import Path

if __name__ == "__main__" and not __package__:
    _repo = Path(__file__).resolve().parents[2]
    _repo_str = str(_repo)
    if _repo_str not in sys.path:
        sys.path.insert(0, _repo_str)
    __package__ = "scripts.gee"

import ee  # noqa: E402 — tras ajustar sys.path

from .config import paths
from .earth_engine_init.ee_init import initialize_ee
from .lib import yearmonth as ym_lib


def _print_block(title: str, lines: tuple[str, ...]) -> None:
    print()
    print("=" * 60)
    print(f"  {title}")
    print("=" * 60)
    for line in lines:
        print(line)


def _audit_ym_asset(label: str, asset_path: str, product_key: str) -> None:
    ic = ee.ImageCollection(asset_path)
    max_ym = ym_lib.get_collection_max_ym(ic)
    n = ic.size().getInfo()
    eff = None
    try:
        eff = ym_lib.effective_yearly_export_year(ic)
    except Exception as e:
        eff = f"(error: {e})"
    msgs = ym_lib.audit_asset_yearmonth_vs_wall_clock_messages(ic, product=product_key)
    lines = (
        f"Asset: {asset_path}",
        f"Imágenes en colección: {n}",
        f"Máximo (año, mes) en metadatos: {max_ym}",
        f"Año anual efectivo (pipeline): {eff}",
    )
    _print_block(label, lines)
    for m in msgs:
        print(m)


def _audit_yearly_asset(label: str, asset_path: str, product_key: str) -> None:
    ic = ee.ImageCollection(asset_path)
    n = ic.size().getInfo()
    max_y = ym_lib.get_collection_max_year(ic)
    msgs = ym_lib.audit_asset_yearly_vs_wall_clock_messages(ic, product=product_key)
    lines = (
        f"Asset: {asset_path}",
        f"Imágenes en colección: {n}",
        f"Máximo año (propiedad year): {max_y}",
    )
    _print_block(label, lines)
    for m in msgs:
        print(m)


def main() -> None:
    parser = argparse.ArgumentParser(description="Auditar assets GEE vs último año/mes completo (UTC).")
    parser.parse_args()

    initialize_ee()

    tgt_month = ym_lib.last_complete_calendar_month_utc()
    tgt_year = ym_lib.last_completed_wall_clock_calendar_year()

    _print_block(
        "Referencias de reloj (UTC)",
        (
            f"Último mes civil cerrado (objetivo año-mes): {tgt_month[0]}-{tgt_month[1]:02d}",
            f"Último año civil cerrado (objetivo anual): {tgt_year}",
            "",
            "Si un asset año-mes queda por debajo del mes objetivo, faltan meses por exportar o la fuente no tuvo datos (n=0).",
            "Si el máximo año en un asset anual es < objetivo, faltan años en el asset.",
        ),
    )

    _audit_ym_asset("NDVI — año-mes", paths.ASSET_NDVI_YEARMONTH, "ndvi")
    _audit_ym_asset("AOD — año-mes", paths.ASSET_AOD_YEARMONTH, "aod")
    _audit_ym_asset("NO2 — año-mes", paths.ASSET_NO2_YEARMONTH, "no2")
    _audit_ym_asset("SO2 — año-mes", paths.ASSET_SO2_YEARMONTH, "so2")

    _audit_yearly_asset("LST — anual (asset)", paths.ASSET_LST_YEARLY, "lst")
    _audit_yearly_asset("Huella urbana — anual (asset)", paths.ASSET_HU_YEARLY, "hu")

    print()
    print("Listo. Revise líneas [GEE audit ...] arriba: OK = alineado con objetivo UTC.")
    print()


if __name__ == "__main__":
    main()
