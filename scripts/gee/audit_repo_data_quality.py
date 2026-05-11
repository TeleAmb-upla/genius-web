#!/usr/bin/env python3
"""
Auditoría **solo local** de calidad semántica de artefactos del repo (sin Earth Engine ni Drive).

Hoy incluye la regla que alimenta el pipeline para LST:

- ``LST_y_urban.csv`` debe ser coherente con ``LST_YearMonth_urban.csv`` (mediana y
  cuartiles mensuales reproducibles frente a las columnas del CSV anual).

Uso (desde la raíz del repositorio):

    python -m scripts.gee.audit_repo_data_quality
    python -m scripts.gee.audit_repo_data_quality --product lst
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

if __name__ == "__main__" and not __package__:
    _repo = Path(__file__).resolve().parents[2]
    _repo_str = str(_repo)
    if _repo_str not in sys.path:
        sys.path.insert(0, _repo_str)
    __package__ = "scripts.gee"

from .config import paths
from .lib.lst_csv_semantics_audit import audit_lst_y_urban_semantics_vs_yearmonth


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Auditoría local de calidad de datos (CSV) para complementar el pipeline GEE.",
    )
    parser.add_argument(
        "--product",
        default="lst",
        choices=("lst", "all"),
        help="Variables con chequeos registrados (default: lst).",
    )
    parser.add_argument(
        "--tol",
        type=float,
        default=1.15,
        metavar="C",
        help="Tolerancia °C entre CSV anual y recomputación desde año–mes (default: 1.15).",
    )
    args = parser.parse_args(argv)

    repo_ok = True
    if args.product in ("lst", "all"):
        y_csv = paths.REPO_CSV_LST / "LST_y_urban.csv"
        ym_csv = paths.REPO_CSV_LST / "LST_YearMonth_urban.csv"
        ok, lines = audit_lst_y_urban_semantics_vs_yearmonth(
            y_csv,
            ym_csv,
            tol_celsius=args.tol,
        )
        if ok:
            print(f"OK  LST anual urbano vs año–mes: {y_csv.name} coherente con {ym_csv.name}.")
        else:
            repo_ok = False
            print(f"FAIL  LST anual urbano ({y_csv.name})", file=sys.stderr)
            for line in lines:
                print(f"  {line}", file=sys.stderr)

    return 0 if repo_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
