#!/usr/bin/env python3
"""
Rellena LST_mean vacío en CSV anuales LST usando (LST_p25 + LST_p75) / 2
cuando ambos cuartiles son válidos (centro de la banda exportada por GEE).

- LST_y_urban.csv
- LST_y_zonal_barrios.csv

No usa LST_YearMonth_urban.csv: los gráficos anuales quedan alineados solo con el CSV.

Uso (raíz del repo):
    python3 scripts/repo/csv/repair_lst_yearly_csv_mean.py
"""
from __future__ import annotations

import csv
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
P_URBAN_Y = ROOT / "assets/data/csv/LST_y_urban.csv"
P_ZONAL_Y = ROOT / "assets/data/csv/LST_y_zonal_barrios.csv"

SENTINEL = -9999.0
SENT_TOL = 0.501


def _float(v: str | None) -> float | None:
    if v is None or str(v).strip() == "":
        return None
    try:
        x = float(str(v).strip())
    except (TypeError, ValueError):
        return None
    if not math.isfinite(x):
        return None
    if abs(x - SENTINEL) < SENT_TOL:
        return None
    if x < -80 or x > 100:
        return None
    return x


def _fmt6(x: float) -> str:
    return f"{x:.6f}"


def _repair_table(path: Path, label: str) -> None:
    if not path.is_file():
        print(f"[skip] no existe {path.relative_to(ROOT)}", file=sys.stderr)
        return
    with path.open(encoding="utf-8", newline="") as f:
        rdr = csv.DictReader(f)
        fieldnames = list(rdr.fieldnames or [])
        rows = list(rdr)
    changed = 0
    for row in rows:
        mean_was = (row.get("LST_mean") or "").strip()
        if mean_was:
            continue
        p25p = _float(row.get("LST_p25"))
        p75p = _float(row.get("LST_p75"))
        if p25p is not None and p75p is not None:
            row["LST_mean"] = _fmt6((p25p + p75p) / 2.0)
            changed += 1
    with path.open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fieldnames, lineterminator="\n")
        w.writeheader()
        w.writerows(rows)
    print(f"  {label}: {len(rows)} filas, LST_mean rellenado en {changed}")


def main() -> int:
    print("Reparar LST_mean vacío en CSV anuales (solo punto medio P25–P75)")
    _repair_table(P_URBAN_Y, "LST_y_urban")
    _repair_table(P_ZONAL_Y, "LST_y_zonal_barrios")
    print("Listo. Regenera el bundle explorador: python3 scripts/repo/bundles/build_lst_zonal_explorer_bundle.py")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
