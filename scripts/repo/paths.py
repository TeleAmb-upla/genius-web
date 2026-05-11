"""Raíz del repositorio genius_upla para módulos bajo ``scripts/repo/``."""
from __future__ import annotations

from pathlib import Path

# scripts/repo/paths.py → parents[2] = raíz del repo
REPO_ROOT = Path(__file__).resolve().parents[2]
