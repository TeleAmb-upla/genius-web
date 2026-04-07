"""
Auditoría de frescura en Google Drive (modifiedTime) antes de encolar exportaciones EE.

Reglas (alineadas al plan pipeline vs Drive/GEE):
- **Mensual**: reexportar si no hay archivos en la carpeta o el ``modifiedTime`` más reciente
  entre los GeoTIFF del prefijo tiene año calendario **menor** que el último año civil cerrado UTC.
- **Anual**: el stem ``{prefix}{year}.tif`` para ``year`` = **último año civil cerrado por reloj**
  UTC (``last_completed_wall_clock_calendar_year``). La existencia en Drive se comprueba para
  ese año. El bypass del pre-flight y el espejo completo anual solo aplican si el asset año-mes
  ya cubre ese año completo (``assets_cover_target_year``).
"""
from __future__ import annotations

import datetime
from dataclasses import dataclass, field
from typing import Any

from . import paths
from .download_drive_to_repo import _find_folder_id, _list_files
from .lib import yearmonth as ym_lib


def parse_drive_modified_time(iso: str | None) -> datetime.datetime | None:
    if not iso or not isinstance(iso, str):
        return None
    s = iso.replace("Z", "+00:00")
    try:
        return datetime.datetime.fromisoformat(s)
    except ValueError:
        return None


def _norm_exts(exts: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(e.lower() if e.startswith(".") else f".{e.lower()}" for e in exts)


def newest_modified_time_for_prefix(
    files: list[dict],
    name_prefix: str,
    extensions: tuple[str, ...],
) -> datetime.datetime | None:
    """Mayor ``modifiedTime`` entre archivos cuyo nombre empieza por ``name_prefix`` (case-sensitive)."""
    exts = _norm_exts(extensions)
    best: datetime.datetime | None = None
    plen = len(name_prefix)
    for f in files:
        n = f.get("name") or ""
        if len(n) < plen or not n.startswith(name_prefix):
            continue
        if not any(n.lower().endswith(e) for e in exts):
            continue
        mt = parse_drive_modified_time(f.get("modifiedTime"))
        if mt is None:
            continue
        if best is None or mt > best:
            best = mt
    return best


def yearly_raster_present_in_drive(
    files: list[dict],
    stem: str,
    extensions: tuple[str, ...],
) -> bool:
    exts = _norm_exts(extensions)
    candidates = {f"{stem.lower()}{e}" for e in exts}
    for f in files:
        n = (f.get("name") or "").lower()
        if n in candidates:
            return True
    return False


def monthly_stale_from_drive_mtime(
    files: list[dict],
    monthly_name_prefix: str,
    extensions: tuple[str, ...],
) -> bool:
    """
    True = conviene reexportar toda la climatología mensual (omitir pre-flight Drive).
    """
    last_cy = ym_lib.last_completed_wall_clock_calendar_year()
    newest = newest_modified_time_for_prefix(files, monthly_name_prefix, extensions)
    if newest is None:
        return True
    return newest.year < last_cy


@dataclass(frozen=True)
class DriveFreshnessHints:
    """Decisiones de pre-flight coherentes con auditoría Drive + espejo local."""

    force_full_monthly_raster_export: bool = False
    # Falta en Drive el anual para target_yearly_year (año civil cerrado reloj).
    yearly_raster_missing_or_stale: bool = False
    # Falta ese raster y el asset ya cubre ese año: omitir pre-flight para reexport.
    yearly_raster_enqueue_bypass: bool = False
    mirror_full_monthly_local: bool = False
    target_yearly_year: int | None = None
    sync_full_mirror_extra_keys: frozenset[str] = field(default_factory=frozenset)
    audit_messages: tuple[str, ...] = ()


def _list_folder_files(service: Any, folder_display_name: str) -> list[dict]:
    try:
        fid = _find_folder_id(service, folder_display_name)
        return _list_files(service, fid)
    except FileNotFoundError:
        return []


def compute_drive_freshness_hints(
    product: str,
    service: Any,
    *,
    target_yearly_year: int,
    assets_cover_target_year: bool = True,
) -> DriveFreshnessHints:
    """
    ``target_yearly_year``: último año civil cerrado **por reloj** UTC (comprobación en Drive).

    ``assets_cover_target_year``: el asset año-mes ya incluye diciembre de ese año (o posterior);
    si es falso, no se fuerza bypass ni espejo anual aunque falte el archivo en Drive.
    """
    msgs: list[str] = []
    monthly_folder: str
    monthly_prefix: str
    yearly_folder: str
    yearly_stem_prefix: str
    mirror_key: str
    yearly_mirror_key: str

    if product == "ndvi":
        monthly_folder = paths.DRIVE_RASTER_MONTHLY
        monthly_prefix = "NDVI_Monthly_"
        yearly_folder = paths.DRIVE_RASTER_YEARLY
        yearly_stem_prefix = "NDVI_Yearly_"
        mirror_key = "raster_monthly"
        yearly_mirror_key = "raster_yearly"
    elif product == "aod":
        monthly_folder = paths.DRIVE_AOD_RASTER_MONTHLY
        monthly_prefix = "AOD_Monthly_"
        yearly_folder = paths.DRIVE_AOD_RASTER_YEARLY
        yearly_stem_prefix = "AOD_Yearly_"
        mirror_key = "aod_raster_monthly"
        yearly_mirror_key = "aod_raster_yearly"
    elif product == "no2":
        monthly_folder = paths.DRIVE_NO2_RASTER_MONTHLY
        monthly_prefix = "NO2_Monthly_"
        yearly_folder = paths.DRIVE_NO2_RASTER_YEARLY
        yearly_stem_prefix = "NO2_Yearly_"
        mirror_key = "no2_raster_monthly"
        yearly_mirror_key = "no2_raster_yearly"
    elif product == "so2":
        monthly_folder = paths.DRIVE_SO2_RASTER_MONTHLY
        monthly_prefix = "SO2_Monthly_"
        yearly_folder = paths.DRIVE_SO2_RASTER_YEARLY
        yearly_stem_prefix = "SO2_Yearly_"
        mirror_key = "so2_raster_monthly"
        yearly_mirror_key = "so2_raster_yearly"
    elif product == "lst":
        monthly_folder = paths.DRIVE_LST_RASTER_MONTHLY
        monthly_prefix = "LST_Monthly_"
        yearly_folder = paths.DRIVE_LST_RASTER_YEARLY
        yearly_stem_prefix = "LST_Yearly_"
        mirror_key = "lst_raster_monthly"
        yearly_mirror_key = "lst_raster_yearly"
    else:
        return DriveFreshnessHints(target_yearly_year=target_yearly_year)

    m_files = _list_folder_files(service, monthly_folder)
    force_monthly = monthly_stale_from_drive_mtime(
        m_files, monthly_prefix, (".tif", ".tiff")
    )
    if force_monthly:
        msgs.append(
            f"[Drive audit] Mensual «{monthly_folder}»: refresco completo "
            f"(sin archivos o mtime más reciente anterior al año civil cerrado "
            f"{ym_lib.last_completed_wall_clock_calendar_year()})."
        )

    y_files = _list_folder_files(service, yearly_folder)
    y_stem = f"{yearly_stem_prefix}{target_yearly_year}"
    yearly_ok = yearly_raster_present_in_drive(y_files, y_stem, (".tif", ".tiff"))
    yearly_missing = not yearly_ok
    yearly_bypass = yearly_missing and assets_cover_target_year
    if yearly_missing:
        msgs.append(
            f"[Drive audit] Anual «{yearly_folder}»: falta {y_stem}.tif "
            f"(objetivo año civil cerrado reloj: {target_yearly_year})."
        )
    if yearly_missing and not assets_cover_target_year:
        msgs.append(
            f"[Drive audit] Anual: el asset año-mes aún no cubre dic. {target_yearly_year}; "
            "no se fuerza reexport anual hasta completar ese año en GEE."
        )

    extra: set[str] = set()
    if force_monthly:
        extra.add(mirror_key)
    if yearly_bypass:
        extra.add(yearly_mirror_key)

    return DriveFreshnessHints(
        force_full_monthly_raster_export=force_monthly,
        yearly_raster_missing_or_stale=yearly_missing,
        yearly_raster_enqueue_bypass=yearly_bypass,
        mirror_full_monthly_local=force_monthly,
        target_yearly_year=target_yearly_year,
        sync_full_mirror_extra_keys=frozenset(extra),
        audit_messages=tuple(msgs),
    )
