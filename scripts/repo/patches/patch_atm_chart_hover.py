#!/usr/bin/env python3
"""Añade geniusBindNearestPointHover a gráficos ATM aún con pageX (one-off)."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[3]
JS = ROOT / "assets/js" / "atm"

IMPORT = "import { geniusBindNearestPointHover } from '../../chart_tooltip_genius.js';\n"

# (relpath from assets/js/atm, band_year | linear_month, value_field, html_fmt)
# html_fmt uses {v} for value field name in row access in template — we emit p.row.FIELD
SPECS = [
    ("no2/g_anual_no2_b.js", "band", "NO2_median", '"NO²: " + p.row.NO2_median.toFixed(2) + "<br>Año: " + p.row.Year'),
    ("no2/g_anual_no2_m.js", "band", "NO2_median", '"NO²: " + p.row.NO2_median.toFixed(2) + "<br>Año: " + p.row.Year'),
    ("no2/g_mensual_no2_b.js", "linear", "NO2_median", '"NO²: " + p.row.NO2_median.toFixed(2) + "<br>Mes: " + p.row.Month'),
    ("no2/g_mensual_no2_m.js", "linear", "NO2_median", '"NO²: " + p.row.NO2_median.toFixed(2) + "<br>Mes: " + p.row.Month'),
    ("so2/g_anual_so2.js", "band", "SO2", '"SO²: " + p.row.SO2.toFixed(2) + "<br>Año: " + p.row.Year'),
    ("so2/g_anual_so2_b.js", "band", "SO2", '"SO²: " + p.row.SO2.toFixed(2) + "<br>Año: " + p.row.Year'),
    ("so2/g_anual_so2_m.js", "band", "SO2", '"SO²: " + p.row.SO2.toFixed(2) + "<br>Año: " + p.row.Year'),
    ("so2/g_mensual_so2.js", "linear", "SO2", '"SO²: " + p.row.SO2.toFixed(2) + "<br>Mes: " + p.row.Month'),
    ("so2/g_mensual_so2_b.js", "linear", "SO2", '"SO²: " + p.row.SO2.toFixed(2) + "<br>Mes: " + p.row.Month'),
    ("so2/g_mensual_so2_m.js", "linear", "SO2", '"SO²: " + p.row.SO2.toFixed(2) + "<br>Mes: " + p.row.Month'),
]


def patch_file(path: Path, kind: str, field: str, html_expr: str) -> bool:
    t = path.read_text(encoding="utf-8")
    if "geniusBindNearestPointHover" in t:
        return False
    if "chart_tooltip_genius" not in t:
        t = t.replace(
            "import { getGeniusChartLayout } from '../../chart_layout_genius.js';\n",
            "import { getGeniusChartLayout } from '../../chart_layout_genius.js';\n" + IMPORT,
            1,
        )
    # Remove tooltip handlers block through mouseleave
    t = re.sub(
        r"\n    // Create a tooltip\n    const tooltip = d3\.select\(`#\$\{containerId\}`\)[\s\S]*?"
        r"var mouseleave = function \(event, d\) \{[\s\S]*?\n    \}\n\n    // Add the line",
        "\n    const tooltip = d3.select(`#${containerId}`)\n"
        "        .append(\"div\")\n"
        "        .style(\"opacity\", 0)\n"
        "        .attr(\"class\", \"tooltip\")\n"
        "        .style(\"background-color\", \"white\")\n"
        "        .style(\"border\", \"solid\")\n"
        "        .style(\"border-width\", \"2px\")\n"
        "        .style(\"border-radius\", \"5px\")\n"
        "        .style(\"padding\", \"5px\")\n"
        "        .style(\"position\", \"absolute\")\n"
        "        .style(\"pointer-events\", \"none\");\n\n    // Add the line",
        t,
        count=1,
    )
    vf = field
    if kind == "band":
        pts = f"""        points: data.map((d) => ({{
            cx: x(d.Year) + x.bandwidth() / 2,
            cy: y(d.{vf}),
            row: d,
        }})),
        html: (p) => {html_expr},"""
        circle = f"""        .attr("cx", d => x(d.Year) + x.bandwidth() / 2)
        .attr("cy", d => y(d.{vf}))"""
    else:
        pts = f"""        points: data.map((d) => ({{
            cx: x(d.Month),
            cy: y(d.{vf}),
            row: d,
        }})),
        html: (p) => {html_expr},"""
        circle = f"""        .attr("cx", d => x(d.Month))
        .attr("cy", d => y(d.{vf}))"""

    bind = f"""
    geniusBindNearestPointHover(svg, {{
        panelId: containerId,
        innerWidth,
        innerHeight,
        tooltip,
{pts}
    }});
"""

    t = re.sub(
        r"(\.attr\(\"r\", 4\)\n)(\s+\.attr\(\"fill\", \"steelblue\"\)\n)"
        r"\s+\.attr\(\"pointer-events\", \"all\"\)\n"
        r"\s+\.on\(\"mouseover\", mouseover\)\n"
        r"\s+\.on\(\"mousemove\", mousemove\)\n"
        r"\s+\.on\(\"mouseleave\", mouseleave\);",
        rf"\1\2        .attr(\"pointer-events\", \"none\");{bind}",
        t,
        count=1,
    )

    # Comment variant "Add larger" vs "Add points"
    t = re.sub(
        r"// Add (larger, invisible circles for better mouse interaction|points)\n\s+",
        "",
        t,
        count=1,
    )

    path.write_text(t, encoding="utf-8")
    return True


def main() -> None:
    base = ROOT / "assets/js/atm"
    for rel, kind, field, html_expr in SPECS:
        p = base / rel
        if patch_file(p, kind, field, html_expr):
            print("patched", rel)


if __name__ == "__main__":
    main()
