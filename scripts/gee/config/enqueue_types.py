"""Tipos compartidos entre productos GEE (NDVI, AOD, NO2, SO2, LST)."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from ..lib import incremental_plan as incplan


@dataclass
class EnqueueResult:
    """Resultado de encolar exportaciones Earth Engine → Drive / Asset."""

    plan: incplan.DerivativePlan
    drive_tasks: list[Any] = field(default_factory=list)
    asset_tasks: list[Any] = field(default_factory=list)
    sync_keys: set[str] = field(default_factory=set)
    sync_full_mirror_keys: set[str] = field(default_factory=set)
    ran_derivative: bool = False
    messages: list[str] = field(default_factory=list)
    state_saved: bool = False
    state_path_msg: str = ""
