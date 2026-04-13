"""
Base class para state management incremental de exportaciones por producto.

Cada producto (NDVI, LST, AOD) mantiene un archivo JSON de estado con:
- last_processed_ym: último (año, mes) procesado para derivadas
- last_trend_raster_full_year: último año con tendencia completa (si aplica)
- otros campos específicos por producto

Esta base class centraliza la lógica común para evitar duplicación entre
products/ndvi/incremental.py, products/lst/incremental.py, products/aod/incremental.py.
"""
from __future__ import annotations

from pathlib import Path

from . import incremental_plan as incplan
from . import state as state_lib


class IncrementalStateManager:
    """
    Base class para gestioón de estado incremental por producto.
    
    Cada subclase debe definir:
    - state_filename: nombre del archivo JSON (ej: "ndvi_export_state.json")
    - root_asset_path: path del asset principal (ej: paths.ASSET_NDVI_YEARMONTH)
    - start_year: año de inicio de datos (ej: 2016 para NDVI)
    - state_root_path: path absoluto donde guardar el archivo (default: scripts/gee/)
    """
    
    state_filename: str
    root_asset_path: str
    start_year: int
    state_root_path: Path
    
    def __init__(
        self,
        state_filename: str,
        root_asset_path: str,
        start_year: int,
        state_root_path: Path | None = None,
    ):
        """
        Args:
            state_filename: nombre del archivo JSON (ej: "ndvi_export_state.json")
            root_asset_path: path completo del asset principal
            start_year: año de inicio de datos
            state_root_path: path donde guardar el archivo (default: scripts/gee/)
        """
        self.state_filename = state_filename
        self.root_asset_path = root_asset_path
        self.start_year = start_year
        
        # Por default, usar scripts/gee/ (un nivel arriba de lib/)
        if state_root_path is None:
            self.state_root_path = Path(__file__).resolve().parents[1]
        else:
            self.state_root_path = state_root_path
    
    def state_path(self) -> Path:
        """Retorna Path al archivo de estado JSON."""
        return self.state_root_path / self.state_filename
    
    def _read_state(self) -> dict:
        """Lee el estado actual desde el archivo JSON."""
        return state_lib.read_state(self.state_path())
    
    def _write_state(self, updates: dict) -> None:
        """Actualiza el estado (merge con existente)."""
        state_lib.merge_state(self.state_path(), updates)
    
    def load_last_processed_ym(self) -> tuple[int, int] | None:
        """Retorna (año, mes) del último procesado para derivadas."""
        return incplan.load_last_processed_ym(self.state_path())
    
    def save_last_processed_ym(self, ym: tuple[int, int]) -> None:
        """Guarda (año, mes) del último procesado para derivadas."""
        incplan.save_last_processed_ym(self.state_path(), ym)
    
    def load_last_trend_raster_full_year(self) -> int | None:
        """Retorna último año civil completo con raster de tendencia exportado."""
        v = self._read_state().get("last_trend_raster_full_year")
        if v is None:
            return None
        try:
            return int(v)
        except (TypeError, ValueError):
            return None
    
    def save_last_trend_raster_full_year(self, year: int) -> None:
        """Guarda que el año fue procesado para tendencia raster."""
        self._write_state({"last_trend_raster_full_year": year})
    
    def plan_derivative_exports(
        self,
        *,
        missing_asset_months: list[tuple[int, int]],
        force_full: bool,
        ic,  # ee.ImageCollection, pero avoiding circular import
    ) -> incplan.DerivativePlan:
        """
        Planifica exportaciones derivadas (CSV, GeoJSON, rasters).
        
        Args:
            missing_asset_months: lista de (año, mes) faltantes en el asset
            force_full: si True, recalcula todo
            ic: ImageCollection del producto
        
        Returns:
            DerivativePlan con meses a procesar y si es full refresh
        """
        return incplan.plan_derivative_exports(
            missing_asset_months=missing_asset_months,
            force_full=force_full,
            ic=ic,
            state_path=self.state_path(),
        )
