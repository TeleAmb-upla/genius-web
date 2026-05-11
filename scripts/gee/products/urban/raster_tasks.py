"""API estable para enqueue; implementación lineal en ``linear/raster.py``."""
from __future__ import annotations

from .linear.raster import *  # noqa: F403

# ``import *`` no reexporta nombres con prefijo subrayado; ``linear/csv.py`` y el resto
# acceden a la implementación solo a través de este módulo.
from .linear.raster import _aoi, _train_rf_model, _validation_kappa
