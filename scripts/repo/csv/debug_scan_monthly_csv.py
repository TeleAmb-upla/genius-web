#!/usr/bin/env python3
"""Escaneo rápido de CSV mensuales: filas, sentinela -9999, cabeceras y muestra."""
from __future__ import annotations

import csv
import json
from pathlib import Path

_SENT = -9999.0


def _scan_file(path: Path, *, numeric_cols: list[str]) -> dict:
    if not path.is_file():
        return {"exists": False}
    with path.open(encoding="utf-8", errors="replace") as f:
        rows = list(csv.DictReader(f))
    n = len(rows)
    sent = 0
    sample = rows[0] if rows else {}
    for row in rows:
        for c in numeric_cols:
            raw = (row.get(c) or "").strip()
            if not raw:
                continue
            try:
                v = float(raw)
            except ValueError:
                continue
            if abs(v - _SENT) < 0.501:
                sent += 1
                break
    return {
        "exists": True,
        "rows": n,
        "rows_with_sentinel": sent,
        "headers": list(sample.keys()) if sample else [],
        "first_row": {k: sample.get(k) for k in list(sample.keys())[:8]},
    }


def main() -> None:
    root = Path(__file__).resolve().parents[3] / "assets/data/csv"
    specs = [
        (
            "AOD_m_urban.csv",
            ["AOD_median", "AOD_p25", "AOD_p75"],
        ),
        (
            "NO2_m_urban.csv",
            ["NO2_median", "NO2_p25", "NO2_p75"],
        ),
        (
            "SO2_m_urban.csv",
            ["SO2", "SO2_p25", "SO2_p75"],
        ),
        (
            "LST_m_urban.csv",
            ["LST_mean", "LST_p25", "LST_p75"],
        ),
        (
            "NDVI_m_av.csv",
            [
                "NDVI_Urbano",
                "NDVI_Gestion",
                "NDVI_Planificacion",
            ],
        ),
    ]
    for name, cols in specs:
        info = _scan_file(root / name, numeric_cols=cols)
        print(json.dumps({"file": name, **info}, ensure_ascii=False))


if __name__ == "__main__":
    main()
