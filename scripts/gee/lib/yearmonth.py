"""Detección de huecos año-mes en ImageCollections de GEE (metadatos year/month)."""
from __future__ import annotations

import datetime
from pathlib import Path

import ee


def last_completed_wall_clock_calendar_year() -> int:
    """
    Último año civil ya terminado en UTC (p. ej. en abril 2026 → 2025).
    Usado para reglas de frescura mensual en Drive/repo (mtime año calendario).
    """
    return datetime.datetime.utcnow().year - 1


def monthly_local_rasters_stale_vs_last_completed_year(
    dest_dir: Path,
    filename_prefix: str,
    extensions: tuple[str, ...] = (".tif", ".tiff"),
) -> bool:
    """
    True si conviene reexportar climatología mensual: sin archivos gestionados en disco,
    o el mtime más reciente es de un año calendario **estrictamente menor** que el último
    año civil cerrado (coherente con auditoría Drive por ``modifiedTime``).
    """
    last_cy = last_completed_wall_clock_calendar_year()
    if not dest_dir.is_dir():
        return True
    exts = tuple(e.lower() if e.startswith(".") else f".{e.lower()}" for e in extensions)
    latest_mtime = 0.0
    for p in dest_dir.iterdir():
        if not p.is_file():
            continue
        if p.suffix.lower() not in exts:
            continue
        if not p.name.startswith(filename_prefix):
            continue
        latest_mtime = max(latest_mtime, p.stat().st_mtime)
    if latest_mtime <= 0:
        return True
    file_year = datetime.datetime.utcfromtimestamp(latest_mtime).year
    return file_year < last_cy


def list_missing_yearmonth_months(
    asset_path: str,
    *,
    start_year: int = 2016,
) -> list[tuple[int, int]]:
    """
    Meses (año, mes) esperados hasta el mes calendario actual excluido (UTC)
    que aún no existen en la colección en ``asset_path``.
    """
    saved = ee.ImageCollection(asset_path)

    def date_key_feat(img: ee.Image) -> ee.Feature:
        y = ee.Number(img.get("year")).format("%04d")
        m = ee.Number(img.get("month")).format("%02d")
        return ee.Feature(None, {"date_key": y.cat("-").cat(m)})

    existing = saved.map(date_key_feat).aggregate_array("date_key").getInfo() or []

    now = datetime.datetime.utcnow()
    current_year = now.year
    end_limit = datetime.datetime(current_year, now.month, 1)

    missing: list[tuple[int, int]] = []
    for y in range(start_year, current_year + 1):
        for m in range(1, 13):
            cur = datetime.datetime(y, m, 1)
            if cur >= end_limit:
                break
            key = f"{y}-{m:02d}"
            if key not in existing:
                missing.append((y, m))
    return missing


def list_missing_yearly(
    asset_path: str,
    *,
    start_year: int,
) -> list[int]:
    """
    Years from ``start_year`` through ``last_completed_wall_clock_calendar_year()``
    that do not exist in the yearly asset collection at ``asset_path``.
    """
    saved = ee.ImageCollection(asset_path)
    existing_raw = saved.aggregate_array("year").getInfo() or []
    existing = {int(y) for y in existing_raw}
    target = last_completed_wall_clock_calendar_year()
    return [y for y in range(start_year, target + 1) if y not in existing]


def get_collection_distinct_years(
    ic: ee.ImageCollection,
    *,
    max_year: int | None = None,
) -> list[int]:
    """
    All distinct ``year`` values in *ic*, sorted ascending, optionally capped at *max_year*.
    """
    raw = ic.aggregate_array("year").distinct().sort().getInfo() or []
    years = sorted(int(y) for y in raw)
    if max_year is not None:
        years = [y for y in years if y <= max_year]
    return years


def get_collection_max_year(ic: ee.ImageCollection) -> int | None:
    """Max ``year`` property in a yearly ImageCollection."""
    n = ic.size().getInfo()
    if n == 0:
        return None
    return int(ee.Number(ic.aggregate_max("year")).getInfo())


def audit_asset_yearly_vs_wall_clock_messages(
    ic: ee.ImageCollection, *, product: str
) -> tuple[str, ...]:
    """Audits a yearly asset collection against the last completed calendar year."""
    target = last_completed_wall_clock_calendar_year()
    max_y = get_collection_max_year(ic)
    tag = product.upper()
    if max_y is None:
        return (
            f"[GEE audit {tag}] Colección anual vacía; encolar assets hasta {target}.",
        )
    if max_y < target:
        return (
            f"[GEE audit {tag}] Asset anual rezagado: máximo {max_y} < objetivo {target}. "
            "Completar assets anuales.",
        )
    return (f"[GEE audit {tag}] Asset anual máximo {max_y}; objetivo {target} (OK).",)


def get_collection_max_ym(ic: ee.ImageCollection) -> tuple[int, int] | None:
    """Mayor (año, mes) presente en la colección (propiedades year/month)."""
    n = ic.size().getInfo()
    if n == 0:
        return None
    ymax = int(ee.Number(ic.aggregate_max("year")).getInfo())
    subset = ic.filter(ee.Filter.eq("year", ymax))
    mmax = int(ee.Number(subset.aggregate_max("month")).getInfo())
    return ymax, mmax


def last_complete_calendar_month_utc() -> tuple[int, int]:
    """Último mes civil cerrado (UTC)."""
    now = datetime.datetime.utcnow()
    if now.month == 1:
        return now.year - 1, 12
    return now.year, now.month - 1


def ym_strictly_before(a: tuple[int, int], b: tuple[int, int]) -> bool:
    """True si el año-mes ``a`` es estrictamente anterior a ``b``."""
    return a[0] < b[0] or (a[0] == b[0] and a[1] < b[1])


def assets_cover_full_calendar_year(
    max_ym: tuple[int, int] | None, year: int
) -> bool:
    """
    True si la colección año-mes tiene al menos hasta diciembre de ``year``
    (hay imagen con year==year y month>=12, o un año posterior).
    """
    if max_ym is None:
        return False
    y, m = max_ym
    return y > year or (y == year and m >= 12)


def effective_yearly_export_year(ic: ee.ImageCollection) -> int:
    """
    Año a exportar como compuesto anual: último año civil cerrado por **reloj** si el asset
    ya cubre ese año completo; si no, el último año completo disponible en la colección.
    """
    wall = last_completed_wall_clock_calendar_year()
    max_ym = get_collection_max_ym(ic)
    if assets_cover_full_calendar_year(max_ym, wall):
        return wall
    return last_full_calendar_year_from_yearmonth_ic(ic)


def audit_asset_yearmonth_vs_wall_clock_messages(
    ic: ee.ImageCollection, *, product: str
) -> tuple[str, ...]:
    """
    Compara el máximo (año, mes) del asset año-mes con el último mes civil cerrado UTC.
    Debe ejecutarse **antes** del pre-flight Drive.
    """
    target = last_complete_calendar_month_utc()
    max_ym = get_collection_max_ym(ic)
    tag = product.upper()
    if max_ym is None:
        return (
            f"[GEE audit {tag}] Colección año-mes vacía; encolar assets hasta "
            f"{target[0]}-{target[1]:02d} (último mes civil cerrado UTC).",
        )
    max_s = f"{max_ym[0]}-{max_ym[1]:02d}"
    tgt_s = f"{target[0]}-{target[1]:02d}"
    if ym_strictly_before(max_ym, target):
        tail = ""
        if product in ("no2", "so2", "aod"):
            tail = (
                " Si la fuente no tiene datos en un mes, el asset no se crea (n=0) y el máximo "
                "puede quedar atrás."
            )
        return (
            f"[GEE audit {tag}] Asset rezagado: máximo {max_s} < objetivo {tgt_s} "
            f"(último mes civil cerrado UTC). Completar assets antes de derivados al día.{tail}",
        )
    return (f"[GEE audit {tag}] Asset año-mes máximo {max_s}; objetivo {tgt_s} (OK).",)


def last_full_calendar_year_from_yearmonth_ic(ic: ee.ImageCollection) -> int:
    """
    Último año civil completo: si el máximo (y,m) tiene m>=12, y; si no, y-1.
    """
    max_ym = get_collection_max_ym(ic)
    if max_ym is None:
        return datetime.datetime.utcnow().year - 1
    y, m = max_ym
    return y if m >= 12 else y - 1


def ym_le(a: tuple[int, int], b: tuple[int, int]) -> bool:
    return a[0] < b[0] or (a[0] == b[0] and a[1] <= b[1])


def ym_advance(y: int, m: int) -> tuple[int, int]:
    if m == 12:
        return y + 1, 1
    return y, m + 1


def new_months_since(
    last: tuple[int, int], max_ym: tuple[int, int]
) -> list[tuple[int, int]]:
    out: list[tuple[int, int]] = []
    y, m = ym_advance(last[0], last[1])
    while ym_le((y, m), max_ym):
        out.append((y, m))
        y, m = ym_advance(y, m)
    return out
