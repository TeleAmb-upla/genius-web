"""
Actualización incremental de exportaciones NDVI: derivados según
``last_derivative_ym`` en ``ndvi_export_state.json``.

Las 12 climatologías ``NDVI_Monthly_MM`` usan ``last_climatology_target_ym``: si la
colección (hasta el último mes civil completo UTC) supera ese tope, se reexportan los
12 GeoTIFF omitiendo el pre-flight en Drive para esos stems.

El raster de tendencia (carpeta Drive ``NDVI_Trend``) usa ``last_trend_raster_full_year``:
si aparece un año civil completo nuevo en la colección, debe volver a exportarse.

Si aún faltan assets mensuales (huecos), solo se encolan tareas de asset; hay que
volver a ejecutar tras completarlas para generar rasters/CSV/GeoJSON actualizados.
"""
from __future__ import annotations

import datetime
from pathlib import Path

import ee

from ...config import paths
from ...earth_engine_init import vectors
from ...lib import incremental_base as inc_base
from ...lib import incremental_plan as incplan
from ...lib import state as state_lib
from ...lib import yearmonth as ym_lib

DerivativePlan = incplan.DerivativePlan

# Instancia de manager (usa base class para funciones comunes)
_manager = inc_base.IncrementalStateManager(
    state_filename="ndvi_export_state.json",
    root_asset_path=paths.ASSET_NDVI_YEARMONTH,
    start_year=2016,
)


def state_path() -> Path:
    """Path al archivo de estado JSON."""
    return _manager.state_path()


def _read_state() -> dict:
    return state_lib.read_state(state_path())


def _write_state(updates: dict) -> None:
    state_lib.merge_state(state_path(), updates)


# Redirigir a manager para funciones comunes
def load_last_processed_ym() -> tuple[int, int] | None:
    return _manager.load_last_processed_ym()


def save_last_processed_ym(ym: tuple[int, int]) -> None:
    _manager.save_last_processed_ym(ym)


def load_last_trend_raster_full_year() -> int | None:
    return _manager.load_last_trend_raster_full_year()


def save_last_trend_raster_full_year(year: int) -> None:
    _manager.save_last_trend_raster_full_year(year)


def load_last_climatology_target_ym() -> tuple[int, int] | None:
    pair = _read_state().get("last_climatology_target_ym")
    if pair and len(pair) == 2:
        try:
            return int(pair[0]), int(pair[1])
        except (TypeError, ValueError):
            pass
    return None


def save_last_climatology_target_ym(ym: tuple[int, int]) -> None:
    """Marca hasta qué (año, mes) se reexportaron las 12 climatologías NDVI_Monthly_MM."""
    _write_state({"last_climatology_target_ym": [ym[0], ym[1]]})


def list_missing_ndvi_yearmonth_months() -> list[tuple[int, int]]:
    """
    Meses (año, mes) que deberían existir en el asset (hasta el mes calendario actual
    excluido, igual que start_ndvi_ym_asset_tasks) y aún no están en la colección.
    """
    return ym_lib.list_missing_yearmonth_months(
        paths.ASSET_NDVI_YEARMONTH,
        start_year=2016,
    )


def get_collection_max_ym(ic: ee.ImageCollection) -> tuple[int, int] | None:
    """Mayor (año, mes) presente en la colección (metadatos year/month)."""
    return ym_lib.get_collection_max_ym(ic)


def last_complete_calendar_month_utc() -> tuple[int, int]:
    """Último mes civil ya cerrado (UTC): en abril 2026 → marzo 2026."""
    return ym_lib.last_complete_calendar_month_utc()


def target_ym_for_monthly_climatology(ic: ee.ImageCollection) -> tuple[int, int] | None:
    """
    Tope de la serie mensual para climatologías: no más allá del último mes en la
    colección ni del último mes calendario completo (el mes en curso no cuenta).
    """
    col_max = get_collection_max_ym(ic)
    if col_max is None:
        return None
    cal_last = last_complete_calendar_month_utc()
    return col_max if ym_lib.ym_le(col_max, cal_last) else cal_last


def should_refresh_monthly_climatology(ic: ee.ImageCollection) -> bool:
    """
    True si hay datos en NDVI_YearMonth más nuevos que el último ciclo de las 12
    climatologías guardado en ``last_climatology_target_ym`` (o aún no guardado).
    """
    target = target_ym_for_monthly_climatology(ic)
    if target is None:
        return False
    stored = load_last_climatology_target_ym()
    if stored is None:
        return True
    return ym_lib.ym_le(stored, target) and stored != target


def last_full_calendar_year_from_ndvi_collection(ic: ee.ImageCollection) -> int:
    """
    Último año civil “completo” para productos anuales (zonal GeoJSON, etc.):
    si el último mes disponible en NDVI_YearMonth es diciembre, ese año cuenta como
    completo; si no (p. ej. máximo 2026-03), el último año completo es el anterior
    (2025). No usar solo ``datetime.utcnow().year - 1`` (en 2025 eso daba 2024).
    """
    return ym_lib.last_full_calendar_year_from_yearmonth_ic(ic)


def load_last_trend_raster_full_year() -> int | None:
    v = _read_state().get("last_trend_raster_full_year")
    if v is None:
        return None
    try:
        return int(v)
    except (TypeError, ValueError):
        return None


def save_last_trend_raster_full_year(year: int) -> None:
    """Último año civil completo reflejado en el raster de tendencia (Mann–Kendall + Sen)."""
    _write_state({"last_trend_raster_full_year": year})


def should_refresh_trend_raster(ic: ee.ImageCollection) -> bool:
    """
    True si el año anual efectivo (reloj + cobertura asset) supera el registrado tras la
    última exportación de tendencia raster (hay que recalcular la tendencia).
    """
    lfy = ym_lib.effective_yearly_export_year(ic)
    sy = load_last_trend_raster_full_year()
    if sy is None:
        return True
    return lfy > sy


def monthly_rasters_stale_vs_max_ym(max_ym: tuple[int, int]) -> bool:
    """
    True si conviene volver a exportar las 12 climatologías mensuales (NDVI_Monthly_MM):
    el año (UTC) de la última modificación de cualquier .tif local difiere del año del
    último mes disponible en la colección (max_ym[0]). Sin .tif locales → True.
    """
    dest = paths.REPO_RASTER_NDVI_MONTHLY
    if not dest.is_dir():
        return True
    prefix = "NDVI_Monthly_"
    latest_mtime = 0.0
    for p in dest.iterdir():
        if not p.is_file():
            continue
        if p.suffix.lower() not in (".tif", ".tiff"):
            continue
        if not p.name.startswith(prefix):
            continue
        latest_mtime = max(latest_mtime, p.stat().st_mtime)
    if latest_mtime <= 0:
        return True
    file_year = datetime.datetime.utcfromtimestamp(latest_mtime).year
    return file_year != max_ym[0]


def new_months_since(
    last: tuple[int, int], max_ym: tuple[int, int]
) -> list[tuple[int, int]]:
    """Meses (y,m) con last < (y,m) <= max_ym (orden lexicográfico año-mes)."""
    return ym_lib.new_months_since(last, max_ym)


def plan_derivative_exports(
    *,
    missing_asset_months: list[tuple[int, int]],
    force_full: bool,
) -> DerivativePlan:
    return incplan.plan_derivative_exports(
        missing_asset_months=missing_asset_months,
        force_full=force_full,
        ic=vectors.ndvi_yearmonth_collection(),
        state_path=state_path(),
    )
