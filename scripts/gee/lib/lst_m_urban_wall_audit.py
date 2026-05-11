"""
Auditoría local de ``LST_m_urban.csv``: columna ``anio_actual`` para meses 1..último mes
civil cerrado UTC (misma regla que ``yearmonth.last_complete_calendar_month_utc`` / GEE).

Sirve tras ``download_drive_to_repo`` sin inicializar Earth Engine. Uso:

    python -m scripts.gee.lib.lst_m_urban_wall_audit
"""
from __future__ import annotations

import csv
from datetime import datetime, timezone
import io
import sys
from pathlib import Path

_ANIO_SENTINEL = -9999.0


def last_complete_calendar_month_utc_py() -> tuple[int, int]:
    """Último mes civil cerrado (UTC), sin depender de ``ee``."""
    now = datetime.now(timezone.utc)
    if now.month == 1:
        return now.year - 1, 12
    return now.year, now.month - 1


def _cell_valid_anio_lst(raw: str) -> bool:
    s = (raw or "").strip()
    if not s:
        return False
    try:
        v = float(s)
    except (ValueError, OverflowError):
        return False
    if v != v:  # NaN
        return False
    if abs(v - _ANIO_SENTINEL) < 1e-3:
        return False
    # LST superficial (°C) — rango holgado para validar frente al sentinela / huecos
    return -100.0 <= v <= 100.0


def audit_lst_m_urban_repo_csv(
    path: Path,
    *,
    wall: tuple[int, int] | None = None,
) -> tuple[bool, list[str]]:
    """
    Comprueba que exista ``anio_actual`` válido para cada mes ``1 .. lm`` con
    ``(ly, lm) = wall`` o el wall calculado ahora.
    """
    lines: list[str] = []
    ly, lm = wall if wall is not None else last_complete_calendar_month_utc_py()
    if not path.is_file():
        lines.append(f"No existe {path.name} — sincronice ``lst_csv_monthly`` desde Drive.")
        return False, lines
    try:
        text = path.read_text(encoding="utf-8", errors="replace").strip()
    except OSError as exc:
        lines.append(f"No se pudo leer {path.name}: {exc}")
        return False, lines
    if not text:
        lines.append(f"Archivo vacío: {path.name}")
        return False, lines
    try:
        reader = csv.DictReader(io.StringIO(text))
        fieldnames = reader.fieldnames or []
    except Exception as exc:
        lines.append(f"Error leyendo {path.name}: {exc}")
        return False, lines
    if "Month" not in fieldnames or "anio_actual" not in fieldnames:
        lines.append(
            f"{path.name}: faltan columnas Month y/o anio_actual — export GEE incompleto."
        )
        return False, lines
    by_m: dict[int, str] = {}
    for row in reader:
        raw_m = (row.get("Month") or "").strip()
        if not raw_m:
            continue
        try:
            mo = int(float(raw_m))
        except (ValueError, OverflowError):
            continue
        by_m[mo] = (row.get("anio_actual") or "").strip()
    bad: list[int] = []
    for m in range(1, lm + 1):
        if not _cell_valid_anio_lst(by_m.get(m, "")):
            bad.append(m)
    if not bad:
        return True, []
    lines.append(
        f"LST mensual urbano: ``anio_actual`` inválido o ausente para el año civil {ly} "
        f"hasta el mes {lm} (último mes cerrado UTC: {ly}-{lm:02d})."
    )
    lines.append(
        f"Meses con huecos o sentinela {_ANIO_SENTINEL:g}: "
        f"{', '.join(str(x) for x in bad)}. "
        "Reexporte ``start_lst_csv_tasks`` (GEE) y vuelva a sincronizar; si persiste, "
        "revise que el flujo Landsat cubra esos (año, mes)."
    )
    return False, lines


def lst_m_urban_anio_valid_for_wall_months(path: Path) -> bool:
    ok, _ = audit_lst_m_urban_repo_csv(path)
    return ok


def main(argv: list[str] | None = None) -> int:
    repo = Path(__file__).resolve().parents[3]
    csv_path = Path(repo) / "assets" / "data" / "csv" / "LST_m_urban.csv"
    if argv and len(argv) > 1:
        csv_path = Path(argv[1]).expanduser()
    ok, lines = audit_lst_m_urban_repo_csv(csv_path)
    for line in lines:
        print(line, file=sys.stderr if not ok else sys.stdout)
    if ok:
        ly, lm = last_complete_calendar_month_utc_py()
        print(
            f"OK: {csv_path.name} cubre anio_actual para meses 1–{lm} "
            f"(año civil {ly}, último mes cerrado UTC)."
        )
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
