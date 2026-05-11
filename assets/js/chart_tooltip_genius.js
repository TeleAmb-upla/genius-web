/**
 * Hover interactivo para gráficos D3 en .chart-container (index2 y index).
 * Superficie transparente sobre el área del trazo: el punto más cercano al cursor
 * muestra un tooltip con datos del CSV (sin depender de círculos pequeños).
 */
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';

/**
 * @param {import('d3').Selection} svgInner - grupo <g> tras translate(margin)
 * @param {object} opts
 * @param {string} opts.panelId - id del div contenedor (#p02 sin #)
 * @param {number} opts.innerWidth
 * @param {number} opts.innerHeight
 * @param {import('d3').Selection} opts.tooltip - selección del div.tooltip
 * @param {Array<{ cx: number, cy: number, row?: object, color?: string }>} opts.points
 * @param {(hit: { cx: number, cy: number, row?: object, color?: string }) => string} opts.html
 */
export function geniusBindNearestPointHover(svgInner, opts) {
    const { panelId, innerWidth, innerHeight, tooltip, points, html } = opts;
    const host = document.getElementById(panelId);
    if (!host || !points?.length) return;

    const focusColor = opts.focusColor ?? "steelblue";
    const layer = svgInner.append("g").attr("class", "ge-chart-hover-layer");
    const focus = layer
        .append("g")
        .attr("class", "ge-chart-focus")
        .style("pointer-events", "none")
        .style("display", "none");
    focus
        .append("circle")
        .attr("r", 6)
        .attr("fill", focusColor)
        .attr("stroke", "#fff")
        .attr("stroke-width", 1.5);

    layer.append("rect")
        .attr("class", "ge-chart-hover-surface")
        .attr("width", innerWidth)
        .attr("height", innerHeight)
        .attr("fill", "transparent")
        .style("cursor", "crosshair")
        .on("mouseleave", () => {
            tooltip.style("opacity", 0);
            focus.style("display", "none");
        })
        .on("mousemove", function (event) {
            const [mx, my] = d3.pointer(event, this);
            let best = points[0];
            let bestDist = Infinity;
            for (const p of points) {
                const dx = p.cx - mx;
                const dy = p.cy - my;
                const dist = dx * dx + dy * dy;
                if (dist < bestDist) {
                    bestDist = dist;
                    best = p;
                }
            }
            tooltip.style("opacity", 1).html(html(best));
            const r = host.getBoundingClientRect();
            tooltip.style("left", event.clientX - r.left + 14 + "px").style(
                "top",
                event.clientY - r.top - 12 + "px",
            );
            focus.style("display", null);
            focus.attr("transform", `translate(${best.cx},${best.cy})`);
            focus.select("circle").attr("fill", best.color ?? focusColor);
        });
}

/** Tooltips en barras horizontales / verticales: posición respecto al panel */
export function geniusTooltipSetPosition(panelId, event, tooltip, dx = 14, dy = -12) {
    const host = document.getElementById(panelId);
    if (!host) return;
    const r = host.getBoundingClientRect();
    tooltip
        .style("left", event.clientX - r.left + dx + "px")
        .style("top", event.clientY - r.top + dy + "px");
}
