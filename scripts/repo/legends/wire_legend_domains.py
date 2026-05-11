#!/usr/bin/env python3
"""Replace const domain = [...] with legendDomain(...) and add imports. Run from repo root.

Después de editar SPECS o los imports, ejecuta:
    python3 scripts/repo/legends/verify_legend_ranges_imports.py
para comprobar que cada ruta relativa apunta a assets/js/legend_ranges.js.
"""
from __future__ import annotations

import re
from pathlib import Path

REPO = Path(__file__).resolve().parents[3]
JS_ROOT = REPO / "assets" / "js"

DOMAIN_LINE = re.compile(r"^\s*const domain =\s*\[.*?\]\s*;?.*$", re.MULTILINE)

# path relative to assets/js: (import from file, list of (product, scope, mode) per domain line in file order)
SPECS: dict[str, tuple[str, list[tuple[str, str, str]]]] = {
    # NDVI
    "ndvi/ndvi_year/ndvi_palette.js": ("../../legend_ranges.js", [("ndvi", "raster", "yearly")]),
    "ndvi/ndvi_month/ndvi_palette_month.js": ("../../legend_ranges.js", [("ndvi", "raster", "monthly")]),
    "ndvi/map_utilities_p.js": ("../legend_ranges.js", [("ndvi", "raster", "yearly"), ("ndvi", "raster", "monthly")]),
    "ndvi/ndvi_z_b/ndvi_palette_z_b_y.js": ("../../legend_ranges.js", [("ndvi", "zonalBarrio", "yearly")]),
    "ndvi/ndvi_z_b/ndvi_palette_z_b_m.js": ("../../legend_ranges.js", [("ndvi", "zonalBarrio", "monthly")]),
    "ndvi/ndvi_z_m/ndvi_palette_z_m_y.js": ("../../legend_ranges.js", [("ndvi", "zonalManzana", "yearly")]),
    "ndvi/ndvi_z_m/ndvi_palette_z_m_m.js": ("../../legend_ranges.js", [("ndvi", "zonalManzana", "monthly")]),
    "ndvi/ndvi_z_b/legend.js": ("../../legend_ranges.js", [("ndvi", "zonalBarrio", "yearly"), ("ndvi", "zonalBarrio", "monthly")]),
    "ndvi/ndvi_z_m/legend.js": ("../../legend_ranges.js", [("ndvi", "zonalManzana", "yearly"), ("ndvi", "zonalManzana", "monthly")]),
    "ndvi/ndvi_z_b/trend_b.js": ("../../legend_ranges.js", [("ndvi", "zonalBarrio", "trend"), ("ndvi", "zonalBarrio", "trend")]),
    "ndvi/ndvi_z_m/trend_m.js": ("../../legend_ranges.js", [("ndvi", "zonalManzana", "trend"), ("ndvi", "zonalManzana", "trend")]),
    # LST
    "temp/year/palette_year.js": ("../../legend_ranges.js", [("lst", "raster", "yearly")]),
    "temp/month/palette_month.js": ("../../legend_ranges.js", [("lst", "raster", "monthly")]),
    "temp/map_utilities_p.js": ("../legend_ranges.js", [("lst", "raster", "yearly"), ("lst", "raster", "monthly")]),
    "temp/lst_trend/trend.js": ("../../legend_ranges.js", [("lst", "raster", "trend"), ("lst", "raster", "trend")]),
    "temp/temp_z_b/ndvi_palette_z_b_y.js": ("../../legend_ranges.js", [("lst", "zonalBarrio", "yearly")]),
    "temp/temp_z_b/ndvi_palette_z_b_m.js": ("../../legend_ranges.js", [("lst", "zonalBarrio", "monthly")]),
    "temp/temp_z_m/ndvi_palette_z_m_y.js": ("../../legend_ranges.js", [("lst", "zonalManzana", "yearly")]),
    "temp/temp_z_m/ndvi_palette_z_m_m.js": ("../../legend_ranges.js", [("lst", "zonalManzana", "monthly")]),
    "temp/temp_z_b/legend.js": ("../../legend_ranges.js", [("lst", "zonalBarrio", "monthly")]),
    "temp/temp_z_m/legend.js": ("../../legend_ranges.js", [("lst", "zonalManzana", "yearly"), ("lst", "zonalManzana", "monthly")]),
    "temp/temp_z_b/trend_b.js": ("../../legend_ranges.js", [("lst", "zonalBarrio", "trend"), ("lst", "zonalBarrio", "trend")]),
    "temp/temp_z_m/trend_m.js": ("../../legend_ranges.js", [("lst", "zonalManzana", "trend"), ("lst", "zonalManzana", "trend")]),
    # AOD
    "atm/aod/year/palette_year.js": ("../../../legend_ranges.js", [("aod", "raster", "yearly")]),
    "atm/aod/month/palette_month.js": ("../../../legend_ranges.js", [("aod", "raster", "monthly")]),
    "atm/aod/map_utilities_p.js": ("../../legend_ranges.js", [("aod", "raster", "yearly"), ("aod", "raster", "monthly")]),
    "atm/aod/aod_trend/trend.js": ("../../../legend_ranges.js", [("aod", "raster", "trend"), ("aod", "raster", "trend")]),
    "atm/aod/aod_z_b/ndvi_palette_z_b_y.js": ("../../../legend_ranges.js", [("aod", "zonalBarrio", "yearly")]),
    "atm/aod/aod_z_b/ndvi_palette_z_b_m.js": ("../../../legend_ranges.js", [("aod", "zonalBarrio", "monthly")]),
    "atm/aod/aod_z_m/ndvi_palette_z_m_y.js": ("../../../legend_ranges.js", [("aod", "zonalManzana", "yearly")]),
    "atm/aod/aod_z_m/ndvi_palette_z_m_m.js": ("../../../legend_ranges.js", [("aod", "zonalManzana", "monthly")]),
    "atm/aod/aod_z_b/legend.js": ("../../../legend_ranges.js", [("aod", "zonalBarrio", "yearly"), ("aod", "zonalBarrio", "monthly")]),
    "atm/aod/aod_z_m/legend.js": ("../../../legend_ranges.js", [("aod", "zonalManzana", "yearly"), ("aod", "zonalManzana", "monthly")]),
    "atm/aod/aod_z_b/trend_b.js": ("../../../legend_ranges.js", [("aod", "zonalBarrio", "trend"), ("aod", "zonalBarrio", "trend")]),
    "atm/aod/aod_z_m/trend_m.js": ("../../../legend_ranges.js", [("aod", "zonalManzana", "trend"), ("aod", "zonalManzana", "trend")]),
    # NO2
    "atm/no2/year/palette_year.js": ("../../../legend_ranges.js", [("no2", "raster", "yearly")]),
    "atm/no2/month/palette_month.js": ("../../../legend_ranges.js", [("no2", "raster", "monthly")]),
    "atm/no2/map_utilities_p.js": ("../../legend_ranges.js", [("no2", "raster", "yearly"), ("no2", "raster", "monthly")]),
    "atm/no2/no2_trend/trend.js": ("../../../legend_ranges.js", [("no2", "raster", "trend"), ("no2", "raster", "trend")]),
    "atm/no2/no2_z_b/ndvi_palette_z_b_y.js": ("../../../legend_ranges.js", [("no2", "zonalBarrio", "yearly")]),
    "atm/no2/no2_z_b/ndvi_palette_z_b_m.js": ("../../../legend_ranges.js", [("no2", "zonalBarrio", "monthly")]),
    "atm/no2/no2_z_m/ndvi_palette_z_m_y.js": ("../../../legend_ranges.js", [("no2", "zonalManzana", "yearly")]),
    "atm/no2/no2_z_m/ndvi_palette_z_m_m.js": ("../../../legend_ranges.js", [("no2", "zonalManzana", "monthly")]),
    "atm/no2/no2_z_b/legend.js": ("../../../legend_ranges.js", [("no2", "zonalBarrio", "yearly"), ("no2", "zonalBarrio", "monthly")]),
    "atm/no2/no2_z_m/legend.js": ("../../../legend_ranges.js", [("no2", "zonalManzana", "yearly"), ("no2", "zonalManzana", "monthly")]),
    "atm/no2/no2_z_b/trend_b.js": ("../../../legend_ranges.js", [("no2", "zonalBarrio", "trend"), ("no2", "zonalBarrio", "trend")]),
    "atm/no2/no2_z_m/trend_m.js": ("../../../legend_ranges.js", [("no2", "zonalManzana", "trend"), ("no2", "zonalManzana", "trend")]),
    # SO2
    "atm/so2/year/palette_year.js": ("../../../legend_ranges.js", [("so2", "raster", "yearly")]),
    "atm/so2/month/palette_month.js": ("../../../legend_ranges.js", [("so2", "raster", "monthly")]),
    "atm/so2/map_utilities_p.js": ("../../legend_ranges.js", [("so2", "raster", "yearly"), ("so2", "raster", "monthly")]),
    "atm/so2/so2_trend/trend.js": ("../../../legend_ranges.js", [("so2", "raster", "trend"), ("so2", "raster", "trend")]),
    "atm/so2/so2_z_b/ndvi_palette_z_b_y.js": ("../../../legend_ranges.js", [("so2", "zonalBarrio", "yearly")]),
    "atm/so2/so2_z_b/ndvi_palette_z_b_m.js": ("../../../legend_ranges.js", [("so2", "zonalBarrio", "monthly")]),
    "atm/so2/so2_z_m/ndvi_palette_z_m_y.js": ("../../../legend_ranges.js", [("so2", "zonalManzana", "yearly")]),
    "atm/so2/so2_z_m/ndvi_palette_z_m_m.js": ("../../../legend_ranges.js", [("so2", "zonalManzana", "monthly")]),
    "atm/so2/so2_z_b/legend.js": ("../../../legend_ranges.js", [("so2", "zonalBarrio", "yearly"), ("so2", "zonalBarrio", "monthly")]),
    "atm/so2/so2_z_m/legend.js": ("../../../legend_ranges.js", [("so2", "zonalManzana", "yearly"), ("so2", "zonalManzana", "monthly")]),
    "atm/so2/so2_z_b/trend_b.js": ("../../../legend_ranges.js", [("so2", "zonalBarrio", "trend"), ("so2", "zonalBarrio", "trend")]),
    "atm/so2/so2_z_m/trend_m.js": ("../../../legend_ranges.js", [("so2", "zonalManzana", "trend"), ("so2", "zonalManzana", "trend")]),
    # Multi
    "multi/map_legend_m.js": ("../legend_ranges.js", [("lst", "raster", "yearly")]),
    "multi/multi_tem.js": ("../legend_ranges.js", [("lst", "raster", "yearly")]),
}


def add_import(text: str, imp_path: str) -> str:
    line = f"import {{ legendDomain }} from '{imp_path}';\n"
    if "legend_ranges.js" in text:
        return text
    lines = text.splitlines(keepends=True)
    insert_at = 0
    for i, ln in enumerate(lines):
        if ln.startswith("import "):
            insert_at = i + 1
    lines.insert(insert_at, line)
    return "".join(lines)


def replace_domains(text: str, calls: list[tuple[str, str, str]]) -> str:
    matches = list(DOMAIN_LINE.finditer(text))
    if len(matches) != len(calls):
        raise RuntimeError(f"expected {len(calls)} domain lines, found {len(matches)} in {calls!r}")
    out = []
    pos = 0
    for m, (prod, scope, mode) in zip(matches, calls, strict=True):
        indent = re.match(r"^(\s*)", m.group(0)).group(1)
        out.append(text[pos : m.start()])
        out.append(f"{indent}const domain = legendDomain('{prod}', '{scope}', '{mode}');")
        pos = m.end()
    out.append(text[pos:])
    return "".join(out)


def main() -> None:
    for rel, (imp, calls) in SPECS.items():
        path = JS_ROOT / rel
        raw = path.read_text(encoding="utf-8")
        if "const domain = [" not in raw and "const domain =[" not in raw:
            print("skip (already wired)", rel)
            continue
        raw = add_import(raw, imp)
        raw = replace_domains(raw, calls)
        path.write_text(raw, encoding="utf-8")
        print("ok", rel)


if __name__ == "__main__":
    main()
