#!/usr/bin/env python3
"""Compatibilidad: delega al generador ATM (AOD, NO₂, SO₂)."""
from pathlib import Path
import runpy

runpy.run_path(
    str(Path(__file__).resolve().parent / "build_atm_urban_csv_from_barrios.py"),
    run_name="__main__",
)
