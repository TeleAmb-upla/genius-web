import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { geniusTitleForProduct } from '../map_data_catalog.js';
import {
    getGeniusChartLayout,
    GENIUS_CHART_HEADING_CLASS,
    geniusAnnualSeriesLegendMinBottom,
    geniusMonthlyClimAxisTitleY,
    geniusMonthlyClimLegendGroupY,
} from '../chart_layout_genius.js';
import { geniusMonthlyPctlExtentMulti } from '../chart_monthly_pctl_band.js';
import {
    geniusAppendAnioActualLine,
    geniusExpandDomainWithPoints,
    geniusLinePointsFromMonthlyColumn,
    geniusWallNdviAnioActualFromCsv,
} from '../chart_monthly_estado_actual.js';
import { geniusBindNearestPointHover } from '../chart_tooltip_genius.js';

export async function g_m_ndvi_stdev() {
    const container = document.getElementById("p69");
    const { width, height, margin } = getGeniusChartLayout(container);
    d3.select("#p69").selectAll("*").remove();

    const wall = geniusWallNdviAnioActualFromCsv();
    const data = await d3.csv(resolveAssetUrl("assets/data/csv/NDVI_m_av.csv"));

    const seriesKeys = ["NDVI_Urbano", "NDVI_Gestion", "NDVI_Planificacion"];
    const anioCols = {
        NDVI_Urbano: "NDVI_Urbano_anio_actual",
        NDVI_Gestion: "NDVI_Gestion_anio_actual",
        NDVI_Planificacion: "NDVI_Planificacion_anio_actual",
    };
    const extentTriplets = seriesKeys.map((k) => ({ mid: k }));

    data.forEach((d) => {
        d.Month = +d.Month;
        for (const k of seriesKeys) {
            d[k] = +d[k];
        }
    });

    /** @type {Record<string, Array<{ Month: number, v: number }>>} */
    const anioPts = {};
    for (const key of seriesKeys) {
        anioPts[key] = geniusLinePointsFromMonthlyColumn(
            data,
            anioCols[key],
            wall.month,
        );
    }

    const allAnioV = seriesKeys.flatMap((k) => anioPts[k].map((p) => p.v));
    const [minNDVI0, maxNDVI0] = geniusMonthlyPctlExtentMulti(data, extentTriplets);
    const [minNDVI, maxNDVI] = geniusExpandDomainWithPoints(
        minNDVI0,
        maxNDVI0,
        allAnioV,
    );

    const svg = d3.select("#p69")
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
        .text(geniusTitleForProduct("NDVI mensual — zona verde", "ndvi"));

    const legendData = [
        { label: "NDVI Urbano", color: "steelblue" },
        { label: "NDVI Gestión", color: "green" },
        { label: "NDVI Planificación", color: "orange" },
    ];
    const itemW = 118;
    const legendWidth = legendData.length * itemW;

    const left = margin.left;
    const right = margin.right;
    const plotTop = titleY + 16;
    const footerH = geniusAnnualSeriesLegendMinBottom();
    const plotWidth = width - left - right;
    const plotHeight = Math.max(80, height - plotTop - footerH);
    const top = plotTop;
    const plotBottomY = top + plotHeight;

    const x = d3.scaleBand()
        .domain(data.map((d) => d.Month))
        .range([left, left + plotWidth])
        .padding(0.2);

    svg.append("g")
        .attr("transform", `translate(0,${top + plotHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    const y = d3.scaleLinear()
        .domain([minNDVI - 0.01, maxNDVI + 0.01])
        .range([top + plotHeight, top]);

    svg.append("g")
        .attr("transform", `translate(${left},0)`)
        .call(d3.axisLeft(y));

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", left + plotWidth / 2)
        .attr("y", geniusMonthlyClimAxisTitleY(plotBottomY))
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Meses");

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
            .x((d) => x(d.Month) + x.bandwidth() / 2)
            .y((d) => y(d[key]))
            .curve(d3.curveCatmullRom.alpha(0.5));
        svg.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", colors[key])
            .attr("stroke-width", 1.5)
            .attr("d", lineGen);
    });

    for (const key of seriesKeys) {
        geniusAppendAnioActualLine(svg, {
            xPos: (d) => x(d.Month) + x.bandwidth() / 2,
            y,
            points: anioPts[key],
            color: colors[key],
            strokeWidth: 2.8,
            showDots: false,
        });
    }

    const tooltip = d3.select("#p69")
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
            .attr("cx", (d) => x(d.Month) + x.bandwidth() / 2)
            .attr("cy", (d) => y(d[key]))
            .attr("r", 4)
            .attr("fill", colors[key])
            .attr("pointer-events", "none");
    });

    const hoverG = svg.append("g").attr("transform", `translate(${left},${top})`);
    const hoverSeries = data.flatMap((d) => {
        const cx = x(d.Month) + x.bandwidth() / 2 - left;
        return seriesKeys.map((key) => ({
            cx,
            cy: y(d[key]) - top,
            row: d,
            color: colors[key],
            kind: "series",
            seriesKey: key,
        }));
    });
    const labelForKey = {
        NDVI_Urbano: "NDVI Urbano",
        NDVI_Gestion: "NDVI Gestión",
        NDVI_Planificacion: "NDVI Planificación",
    };
    const hoverAnio = seriesKeys.flatMap((key) =>
        anioPts[key].map((pt) => ({
            cx: x(pt.Month) + x.bandwidth() / 2 - left,
            cy: y(pt.v) - top,
            row: pt,
            color: colors[key],
            kind: "anio",
            seriesKey: key,
        })),
    );
    geniusBindNearestPointHover(hoverG, {
        panelId: "p69",
        innerWidth: plotWidth,
        innerHeight: plotHeight,
        tooltip,
        points: [...hoverSeries, ...hoverAnio],
        html: (p) => {
            if (p.kind === "anio") {
                return (
                    `Año actual (${wall.year}) · ` +
                    labelForKey[p.seriesKey] +
                    ": " +
                    p.row.v.toFixed(3) +
                    "<br>Mes: " +
                    p.row.Month
                );
            }
            const fmtSeries = (label, key) =>
                "<br>" + label + " (climatología): " + p.row[key].toFixed(2);
            return (
                "Mes: " +
                p.row.Month +
                fmtSeries("NDVI Urbano", "NDVI_Urbano") +
                fmtSeries("NDVI Gestión", "NDVI_Gestion") +
                fmtSeries("NDVI Planificación", "NDVI_Planificacion")
            );
        },
    });
}
