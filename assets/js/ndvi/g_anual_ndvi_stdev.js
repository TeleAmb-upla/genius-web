import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { geniusTitleForProduct } from '../map_data_catalog.js';
import {
    getGeniusChartLayout,
    GENIUS_CHART_HEADING_CLASS,
    geniusAnnualAxisTitleY,
    geniusAnnualSeriesLegendMinBottom,
    geniusMonthlyClimLegendGroupY,
    geniusConfigureAnnualBandYearAxis,
} from '../chart_layout_genius.js';
import { geniusBindNearestPointHover } from '../chart_tooltip_genius.js';

/** NDVI anual por tipo de área verde (Urbano / Gestión / Planificación), sin bandas P25–P75 (solo este visualizador). */
export async function g_a_ndvi_stdev() {
    const container = document.getElementById("p68");
    const { width, height, margin } = getGeniusChartLayout(container);
    d3.select("#p68").selectAll("*").remove();

    const svg = d3.select("#p68")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    const titleY = Math.max(20, Math.round(margin.top * 0.55));
    svg.append("text")
        .attr("x", width * 0.5)
        .attr("y", titleY)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("font-family", "Arial")
        .attr("class", GENIUS_CHART_HEADING_CLASS)
        .text(geniusTitleForProduct("NDVI anual — zona verde", "ndvi"));

    const legendData = [
        { label: "NDVI Urbano", color: "steelblue" },
        { label: "NDVI Gestión", color: "green" },
        { label: "NDVI Planificación", color: "orange" },
    ];
    const itemW = 118;
    const legendWidth = legendData.length * itemW;

    const data = await d3.csv(resolveAssetUrl("assets/data/csv/NDVI_y_av.csv"));

    data.forEach((d) => {
        d.Year = +d.Year;
        d.NDVI_Urbano = +d.NDVI_Urbano;
        d.NDVI_Gestion = +d.NDVI_Gestion;
        d.NDVI_Planificacion = +d.NDVI_Planificacion;
    });

    const seriesKeys = ["NDVI_Urbano", "NDVI_Gestion", "NDVI_Planificacion"];
    let minNDVI = Infinity;
    let maxNDVI = -Infinity;
    for (const d of data) {
        for (const k of seriesKeys) {
            const v = d[k];
            if (v != null && Number.isFinite(+v)) {
                minNDVI = Math.min(minNDVI, +v);
                maxNDVI = Math.max(maxNDVI, +v);
            }
        }
    }
    if (!Number.isFinite(minNDVI)) {
        minNDVI = 0;
        maxNDVI = 1;
    }

    const left = margin.left;
    const right = margin.right;
    const plotTop = titleY + 16;
    const footerH = geniusAnnualSeriesLegendMinBottom();
    const plotWidth = width - left - right;
    const plotHeight = Math.max(80, height - plotTop - footerH);
    const top = plotTop;
    const plotBottomY = top + plotHeight;

    const x = d3.scaleBand()
        .domain(data.map((d) => d.Year))
        .range([left, left + plotWidth])
        .padding(0.2);

    const xAxisG = svg.append("g").attr(
        "transform",
        `translate(0,${plotBottomY})`,
    );
    geniusConfigureAnnualBandYearAxis(xAxisG, x);

    const y = d3.scaleLinear()
        .domain([minNDVI - 0.01, maxNDVI + 0.01])
        .range([top + plotHeight, top]);

    svg.append("g")
        .attr("transform", `translate(${left},0)`)
        .call(d3.axisLeft(y));

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", left + plotWidth / 2)
        .attr("y", geniusAnnualAxisTitleY(plotBottomY))
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Años");

    const legend = svg.append("g")
        .attr(
            "transform",
            `translate(${(width - legendWidth) / 2}, ${geniusMonthlyClimLegendGroupY(plotBottomY)})`,
        );
    legend.selectAll("rect")
        .data(legendData)
        .enter()
        .append("rect")
        .attr("x", (d, i) => i * itemW)
        .attr("y", 0)
        .attr("width", 14)
        .attr("height", 14)
        .attr("fill", (d) => d.color);
    legend.selectAll("text")
        .data(legendData)
        .enter()
        .append("text")
        .attr("x", (d, i) => i * itemW + 18)
        .attr("y", 12)
        .style("font-size", "11px")
        .style("font-family", "Arial")
        .text((d) => d.label);

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr(
            "transform",
            `translate(${left - 36},${top + plotHeight / 2}) rotate(-90)`,
        )
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("NDVI");

    const colors = {
        NDVI_Urbano: "steelblue",
        NDVI_Gestion: "green",
        NDVI_Planificacion: "orange",
    };

    Object.keys(colors).forEach((key) => {
        const lineGen = d3.line()
            .x((d) => x(d.Year) + x.bandwidth() / 2)
            .y((d) => y(d[key]))
            .curve(d3.curveCatmullRom.alpha(0.5));

        svg.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", colors[key])
            .attr("stroke-width", 1.5)
            .attr("d", lineGen);
    });

    const tooltip = d3.select("#p68")
        .append("div")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px")
        .style("position", "absolute")
        .style("pointer-events", "none");

    seriesKeys.forEach((key) => {
        svg.append("g")
            .selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("cx", (d) => x(d.Year) + x.bandwidth() / 2)
            .attr("cy", (d) => y(d[key]))
            .attr("r", 4)
            .attr("fill", colors[key])
            .attr("pointer-events", "none");
    });

    const hoverG = svg.append("g").attr("transform", `translate(${left},${top})`);
    geniusBindNearestPointHover(hoverG, {
        panelId: "p68",
        innerWidth: plotWidth,
        innerHeight: plotHeight,
        tooltip,
        points: data.flatMap((d) => {
            const cx = x(d.Year) + x.bandwidth() / 2 - left;
            return seriesKeys.map((key) => ({
                cx,
                cy: y(d[key]) - top,
                row: d,
                color: colors[key],
            }));
        }),
        html: (p) => {
            const r = p.row;
            return (
                "Año: " +
                r.Year +
                "<br>NDVI Urbano: " +
                r.NDVI_Urbano.toFixed(2) +
                "<br>NDVI Gestión: " +
                r.NDVI_Gestion.toFixed(2) +
                "<br>NDVI Planificación: " +
                r.NDVI_Planificacion.toFixed(2)
            );
        },
    });
}
