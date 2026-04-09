"""
Salida de terminal alineada para auditoría: producto (NDVI, LST, …), fase y tipo de dato.

Usado por ``pipeline``, ``export_all``, ``download_drive_to_repo`` y ``task_wait``.
"""
from __future__ import annotations

from typing import Any

_REST_ROLE: dict[str, str] = {
    "raster_monthly": "GeoTIFF mensuales (climatología)",
    "raster_yearly": "GeoTIFF anuales",
    "raster_trend": "GeoTIFF tendencia",
    "raster_sd": "GeoTIFF desvío estándar",
    "csv": "CSV tabulares (NDVI mensual/anual en Drive)",
    "csv_yearmonth": "CSV serie año-mes (NDVI)",
    "csv_monthly": "CSV mensuales",
    "csv_yearly": "CSV anuales",
    "csv_total": "CSV total hectáreas",
    "csv_prc": "CSV áreas dentro/fuera PRC",
    "geo_monthly_b": "GeoJSON zonales mensuales (barrios)",
    "geo_monthly_m": "GeoJSON zonales mensuales (manzanas)",
    "geo_yearly_b": "GeoJSON zonales anuales (barrios)",
    "geo_yearly_m": "GeoJSON zonales anuales (manzanas)",
    "geo_sd_av": "GeoJSON desvío estándar (áreas verdes)",
    "geo_trend_b": "GeoJSON tendencia (barrios)",
    "geo_trend_m": "GeoJSON tendencia (manzanas)",
}


def _sync_key_rest(key: str) -> str:
    for p in ("aod_", "no2_", "so2_", "lst_", "hu_"):
        if key.startswith(p):
            return key[len(p):]
    return key


def sync_key_variable_tag(key: str) -> str:
    if key.startswith("aod_"):
        return "AOD"
    if key.startswith("no2_"):
        return "NO2"
    if key.startswith("so2_"):
        return "SO2"
    if key.startswith("lst_"):
        return "LST"
    if key.startswith("hu_"):
        return "HU"
    return "NDVI"


def sync_key_human_summary(key: str) -> str:
    rest = _sync_key_rest(key)
    role = _REST_ROLE.get(rest, rest.replace("_", " "))
    return f"{sync_key_variable_tag(key)} · {role}"


def format_enqueue_message(product: str, line: str) -> str:
    tag = product.strip().upper()
    s = line.rstrip("\n")
    if not s:
        return s
    return f"[{tag}] {s}"


def print_audit_block(title: str, width: int = 64) -> None:
    bar = "═" * width
    print(f"\n{bar}\n  {title}\n{bar}")


# ── Enhanced audit helpers ────────────────────────────────────────────────

def print_product_summary_box(
    product: str,
    *,
    plan_reason: str,
    max_ym: tuple[int, int] | None = None,
    target_msg: str = "",
    delta_msg: str = "",
    extra_lines: list[str] | None = None,
    width: int = 56,
) -> None:
    """Compact product status box at the start of each product."""
    tag = product.upper()
    inner = width - 4
    top = f"┌─ {tag} " + "─" * max(0, inner - len(tag) - 1) + "┐"
    bot = "└" + "─" * (width - 2) + "┘"
    print(top)

    max_s = f"{max_ym[0]}-{max_ym[1]:02d}" if max_ym else "—"
    _box_line(f"Cobertura:  {max_s}", f"Estado: {plan_reason[:30]}", width)

    if target_msg:
        _box_line(target_msg, delta_msg, width)

    if extra_lines:
        for ln in extra_lines:
            print(f"│ {ln:<{width - 4}} │")

    print(bot)


def _box_line(left: str, right: str, width: int) -> None:
    inner = width - 4
    half = inner // 2
    left_part = left[:half].ljust(half)
    right_part = right[:half].ljust(inner - half)
    print(f"│ {left_part}{right_part} │")


def print_enqueue_counters(result: Any) -> None:
    """Print enqueue task counts from an EnqueueResult."""
    n_asset = len(getattr(result, "asset_tasks", []))
    n_drive = len(getattr(result, "drive_tasks", []))
    n_sync = len(getattr(result, "sync_keys", set()))
    parts = []
    if n_asset:
        parts.append(f"{n_asset} asset")
    if n_drive:
        parts.append(f"{n_drive} drive")
    if n_sync:
        parts.append(f"{n_sync} sync keys")
    if parts:
        print(f"  Encoladas: {', '.join(parts)}")
    else:
        print("  Encoladas: 0 tareas")


def print_download_summary(
    *,
    downloaded: int,
    skipped: int = 0,
    errors: int = 0,
    size_mb: float | None = None,
) -> None:
    """Summary line after drive sync completes."""
    parts = [f"Descargados: {downloaded}"]
    if size_mb is not None:
        parts[0] += f" ({size_mb:.1f} MB)"
    if skipped:
        parts.append(f"Omitidos: {skipped}")
    parts.append(f"Errores: {errors}")
    print(f"  {' | '.join(parts)}")


def print_global_summary(
    product_results: dict[str, Any],
) -> None:
    """Final summary table across all products."""
    print_audit_block("RESUMEN GLOBAL DEL PIPELINE")
    header = f"  {'Producto':<10} {'Asset':>6} {'Drive':>6} {'Sync':>6}  Estado"
    print(header)
    print("  " + "─" * 50)
    for prod, result in product_results.items():
        n_a = len(getattr(result, "asset_tasks", []))
        n_d = len(getattr(result, "drive_tasks", []))
        n_s = len(getattr(result, "sync_keys", set()))
        reason = getattr(getattr(result, "plan", None), "reason", "—")
        short = reason[:28]
        print(f"  {prod.upper():<10} {n_a:>6} {n_d:>6} {n_s:>6}  {short}")
    print()
