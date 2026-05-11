import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { geniusTitleForProduct } from '../map_data_catalog.js';
import {
    getGeniusChartLayout,
    GENIUS_CHART_HEADING_CLASS,
    geniusMonthlyClimAxisTitleY,
    geniusMonthlyClimMinBottom,
} from '../chart_layout_genius.js';
import {
    geniusAppendMonthlyPctlBand,
    geniusMonthlyPctlExtentMulti,
} from '../chart_monthly_pctl_band.js';
import {
    geniusAppendAnioActualLine,
    geniusAppendMonthlyClimatologyLegend,
    geniusExpandDomainWithPoints,
    geniusFetchYearMonthCsvOptional,
    geniusResolveAnioActualSeries,
    geniusWallCalendarYearMonth,
    GENIUS_ANIO_ACTUAL_CSV_KEY,
    GENIUS_YEARMONTH_CSV,
} from '../chart_monthly_estado_actual.js';
import { geniusMonthlyAnioColor } from '../chart_variable_accent.js';
import { geniusBindNearestPointHover } from '../chart_tooltip_genius.js';
import { geniusLstSeriesYearExcluded } from '../chart_lst_series_policy.js';

export async function g_m_t_islas(containerId = "p73") {
    // Define width and height based on container or fallback
    const container = document.getElementById(containerId);
    const { width, height, margin: m0 } = getGeniusChartLayout(container);
    const margin = { ...m0, bottom: Math.max(m0.bottom, geniusMonthlyClimMinBottom()) };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear any existing SVG
    d3.select("#p73").selectAll("*").remove();

    // Append the svg object to the div with id "p73"
    var svg = d3.select("#p73")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add title
    svg.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", -15)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("font-family", "Arial")
        .attr("class", GENIUS_CHART_HEADING_CLASS)
        .text(geniusTitleForProduct("Temperatura por mes", "lst"));

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
        .text("LST (C°)");

    const wall = geniusWallCalendarYearMonth();
    const [data, ymRows] = await Promise.all([
        d3.csv(resolveAssetUrl("assets/data/csv/LST_m_urban.csv")),
        geniusFetchYearMonthCsvOptional(GENIUS_YEARMONTH_CSV.lstUrban),
    ]);

    // Format the data
    data.forEach((d) => {
        d.Month = +d.Month;
        d.LST_mean = +d.LST_mean;
        if (d.LST_p25 != null && String(d.LST_p25).trim() !== "")
            d.LST_p25 = +d.LST_p25;
        else d.LST_p25 = null;
        if (d.LST_p75 != null && String(d.LST_p75).trim() !== "")
            d.LST_p75 = +d.LST_p75;
        else d.LST_p75 = null;
    });
    const [min0, max0] = geniusMonthlyPctlExtentMulti(data, [
        { mid: "LST_mean", p25: "LST_p25", p75: "LST_p75" },
    ]);
    const anioActual = geniusResolveAnioActualSeries({
        monthlyData: data,
        anioKey: GENIUS_ANIO_ACTUAL_CSV_KEY,
        ymRows,
        ymKeys: { yearKey: "Year", monthKey: "Month", valueKey: "LST_mean" },
        wall,
        lstExcludedYearSlotsPredicate: geniusLstSeriesYearExcluded,
    });
    const anioHasValues = anioActual.points.some(
        (p) => p.v != null && Number.isFinite(p.v),
    );
    const anioColor = geniusMonthlyAnioColor("lst");
    const [min, max] = geniusExpandDomainWithPoints(
        min0,
        max0,
        anioActual.points.map((p) => p.v),
    );

    // Add X axis
    var x = d3.scaleLinear()
        .domain([1, 12]) // Ajustar el dominio al rango de meses
        .range([0, innerWidth]);
    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(12).tickFormat(d3.format("d")));

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([min - 0.01, max + 0.01]) // Adjust the domain to add a margin below and above
        .range([innerHeight, 0]);
    svg.append("g")
        .call(d3.axisLeft(y));

    geniusAppendMonthlyClimatologyLegend(svg, {
        innerWidth,
        innerHeight,
        placement: "belowAxis",
        climColor: "steelblue",
        bandFillColor: "steelblue",
        anioColor: anioHasValues ? anioColor : null,
        anioYear: anioHasValues ? anioActual.year : null,
    });

    geniusAppendMonthlyPctlBand(svg, {
        data,
        x: (d) => x(d.Month),
        y,
        p25Key: "LST_p25",
        p75Key: "LST_p75",
        fill: "steelblue",
        fillOpacity: 0.22,
    });

    const tooltip = d3.select("#p73")
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
        .x(d => x(d.Month)) // Ensure the line passes through the center of the band
        .y(d => y(d.LST_mean))
        .curve(d3.curveCatmullRom.alpha(0.5)); // Use curveCatmullRom for smoothing
    
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
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.Month))
        .attr("cy", d => y(d.LST_mean))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("pointer-events", "none");

    const hoverClim = data.map((d) => ({
        cx: x(d.Month),
        cy: y(d.LST_mean),
        row: d,
        kind: "clim",
    }));
    const hoverAnio = anioActual.points
        .filter((d) => d.v != null && Number.isFinite(d.v))
        .map((d) => ({
        cx: x(d.Month),
        cy: y(d.v),
        row: d,
        kind: "anio",
    }));
    geniusBindNearestPointHover(svg, {
        panelId: "p73",
        innerWidth,
        innerHeight,
        tooltip,
        points: [...hoverClim, ...hoverAnio],
        html: (p) => {
            if (p.kind === "anio") {
                const rv = p.row.v;
                return (
                    `Año actual (${anioActual.year}): ` +
                    (rv != null && Number.isFinite(rv) ? rv.toFixed(2) : "—") +
                    " °C<br>Mes: " +
                    p.row.Month
                );
            }
            let h =
                "LST (P50): " +
                p.row.LST_mean.toFixed(2) +
                "<br>Mes: " +
                p.row.Month;
            if (
                p.row.LST_p25 != null &&
                p.row.LST_p75 != null &&
                !Number.isNaN(p.row.LST_p25) &&
                !Number.isNaN(p.row.LST_p75)
            ) {
                h +=
                    "<br>P25: " +
                    (+p.row.LST_p25).toFixed(2) +
                    " &nbsp; P75: " +
                    (+p.row.LST_p75).toFixed(2);
            }
            return h;
        },
    });
}
