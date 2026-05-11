import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { geniusYearSpanSuffix, getProductYears } from '../../map_data_catalog.js';
import {
    getGeniusChartLayout,
    GENIUS_CHART_HEADING_CLASS,
    geniusMonthlyClimAxisTitleY,
    geniusMonthlyClimMinBottom,
} from '../../chart_layout_genius.js';
import {
    geniusAppendMonthlyPctlBand,
    geniusMonthlyPctlExtentMulti,
    geniusParseMonthlyMetric,
} from '../../chart_monthly_pctl_band.js';
import {
    geniusAppendAnioActualLine,
    geniusAppendMonthlyClimatologyLegend,
    geniusExpandDomainWithPoints,
    geniusFetchYearMonthCsvOptional,
    geniusResolveAnioActualSeries,
    geniusWallCalendarYearMonth,
    GENIUS_ANIO_ACTUAL_CSV_KEY,
    GENIUS_YEARMONTH_CSV,
} from '../../chart_monthly_estado_actual.js';
import { geniusMonthlyAnioColor } from '../../chart_variable_accent.js';
import { geniusBindNearestPointHover } from '../../chart_tooltip_genius.js';

export async function g_m_so2(containerId = "p39") {
    // Get container dimensions
    const container = document.getElementById(containerId);
    const { width, height, margin: m0 } = getGeniusChartLayout(container);
    const margin = { ...m0, bottom: Math.max(m0.bottom, geniusMonthlyClimMinBottom()) };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear any existing SVG
    d3.select(`#${containerId}`).selectAll("*").remove();

    // Append the svg object to the div with id containerId
    var svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Add title
    svg.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("font-family", "Arial")
        .attr("class", GENIUS_CHART_HEADING_CLASS)
        .html(
            () =>
                `SO<tspan baseline-shift="sub">2</tspan> Intraanual Urbano de Quilpué${geniusYearSpanSuffix('so2')} `,
        );

    // titulos ejes 
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", innerWidth / 2)
        .attr("y", geniusMonthlyClimAxisTitleY(innerHeight))
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Meses");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -Math.max(42, Math.round(margin.left * 0.78)))
        .attr("x", -innerHeight / 2)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .html(() => `
        SO<tspan baseline-shift="sub">2</tspan>
    `);

    const wall = geniusWallCalendarYearMonth();
    const [data, ymRowsAll] = await Promise.all([
        d3.csv(resolveAssetUrl("assets/data/csv/SO2_m_urban.csv")),
        geniusFetchYearMonthCsvOptional(GENIUS_YEARMONTH_CSV.so2Urban),
    ]);
    const yearsSo2 = new Set(getProductYears("so2"));
    const ymRows = (ymRowsAll || []).filter((r) =>
        yearsSo2.has(Math.round(+r.Year)),
    );

    data.forEach((d) => {
        d.Month = +d.Month;
        d.SO2 = geniusParseMonthlyMetric(d.SO2);
        d.SO2_p25 = geniusParseMonthlyMetric(d.SO2_p25);
        d.SO2_p75 = geniusParseMonthlyMetric(d.SO2_p75);
    });

    const [min0, max0] = geniusMonthlyPctlExtentMulti(data, [
        { mid: "SO2", p25: "SO2_p25", p75: "SO2_p75" },
    ]);
    const anioActual = geniusResolveAnioActualSeries({
        monthlyData: data,
        anioKey: GENIUS_ANIO_ACTUAL_CSV_KEY,
        ymRows,
        ymKeys: { yearKey: "Year", monthKey: "Month", valueKey: "SO2" },
        wall,
    });
    const anioColor = geniusMonthlyAnioColor("so2");
    const [min, max] = geniusExpandDomainWithPoints(
        min0,
        max0,
        anioActual.points.map((p) => p.v),
    );

    // Add X axis
    var x = d3.scaleLinear()
        .domain([1, 12])
        .range([0, innerWidth]);
    svg.append("g")
        .attr("transform", "translate(0," + innerHeight + ")")
        .call(d3.axisBottom(x).ticks(12).tickFormat(d3.format("d")));

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([min - 0.01, max + 0.01])
        .range([innerHeight, 0]);
    svg.append("g")
        .call(d3.axisLeft(y));

    geniusAppendMonthlyClimatologyLegend(svg, {
        innerWidth,
        innerHeight,
        placement: "belowAxis",
        climColor: "steelblue",
        bandFillColor: "steelblue",
        anioColor: anioActual.points.length ? anioColor : null,
        anioYear: anioActual.points.length ? anioActual.year : null,
    });

    geniusAppendMonthlyPctlBand(svg, {
        data,
        x: (d) => x(d.Month),
        y,
        p25Key: "SO2_p25",
        p75Key: "SO2_p75",
        fill: "steelblue",
        fillOpacity: 0.22,
    });

    const tooltip = d3.select(`#${containerId}`)
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

    // Add the line with smoothing and animation
    var line = d3.line()
        .defined((d) => d.SO2 != null)
        .x(d => x(d.Month))
        .y(d => y(d.SO2))
        .curve(d3.curveMonotoneX);

    var animation = svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
        .attr("stroke-width", 1.5)
        .attr("d", line);

    var totalLength = animation.node().getTotalLength();

    animation
        .attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition()
        .duration(5000)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);

    geniusAppendAnioActualLine(svg, {
        xPos: (d) => x(d.Month),
        y,
        points: anioActual.points,
        color: anioColor,
    });

    svg.append("g")
        .selectAll("circle")
        .data(data.filter((d) => d.SO2 != null))
        .enter()
        .append("circle")
        .attr("cx", d => x(d.Month))
        .attr("cy", d => y(d.SO2))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("pointer-events", "none");
    const hoverClim = data
        .filter((d) => d.SO2 != null)
        .map((d) => ({
            cx: x(d.Month),
            cy: y(d.SO2),
            row: d,
            kind: "clim",
        }));
    const hoverAnio = anioActual.points.map((d) => ({
        cx: x(d.Month),
        cy: y(d.v),
        row: d,
        kind: "anio",
    }));
    geniusBindNearestPointHover(svg, {
        panelId: containerId,
        innerWidth,
        innerHeight,
        tooltip,
        points: [...hoverClim, ...hoverAnio],
        html: (p) => {
            if (p.kind === "anio") {
                return (
                    `Año actual (${anioActual.year}): ` +
                    p.row.v.toFixed(2) +
                    "<br>Mes: " +
                    p.row.Month
                );
            }
            const p50 = p.row.SO2 != null ? p.row.SO2.toFixed(2) : "—";
            let h = "SO² (P50): " + p50 + "<br>Mes: " + p.row.Month;
            if (
                p.row.SO2_p25 != null &&
                p.row.SO2_p75 != null &&
                !Number.isNaN(p.row.SO2_p25) &&
                !Number.isNaN(p.row.SO2_p75)
            ) {
                h +=
                    "<br>P25: " +
                    (+p.row.SO2_p25).toFixed(2) +
                    " &nbsp; P75: " +
                    (+p.row.SO2_p75).toFixed(2);
            }
            return h;
        },
    });

}
