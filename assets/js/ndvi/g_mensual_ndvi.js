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
    geniusResolveAnioActualSeries,
    geniusWallNdviAnioActualFromCsv,
    GENIUS_ANIO_ACTUAL_CSV_KEY,
} from '../chart_monthly_estado_actual.js';
import { geniusMonthlyAnioColor } from '../chart_variable_accent.js';
import { geniusBindNearestPointHover } from '../chart_tooltip_genius.js';

export async function g_m_ndvi() {
    const container = document.getElementById("p03");
    const { width, height, margin: m0 } = getGeniusChartLayout(container);
    const margin = { ...m0, bottom: Math.max(m0.bottom, geniusMonthlyClimMinBottom()) };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear any existing SVG
    d3.select("#p03").selectAll("*").remove();

    // Append the svg object to the div with id "p03"
    var svg = d3.select("#p03")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        // .attr("width", width)
        // .attr("height", height)
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
        .text(geniusTitleForProduct("NDVI por mes", "ndvi"));

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
   .text("NDVI");
   
    const wall = geniusWallNdviAnioActualFromCsv();
    const data = await d3.csv(resolveAssetUrl("assets/data/csv/NDVI_m_urban.csv"));

    // Format the data
    data.forEach((d) => {
        d.Month = +d.Month;
        d.NDVI_median = +d.NDVI;
        if (d.NDVI_p25 != null && String(d.NDVI_p25).trim() !== "")
            d.NDVI_p25 = +d.NDVI_p25;
        else d.NDVI_p25 = null;
        if (d.NDVI_p75 != null && String(d.NDVI_p75).trim() !== "")
            d.NDVI_p75 = +d.NDVI_p75;
        else d.NDVI_p75 = null;
    });
    const [minNDVI0, maxNDVI0] = geniusMonthlyPctlExtentMulti(data, [
        { mid: "NDVI_median", p25: "NDVI_p25", p75: "NDVI_p75" },
    ]);
    const anioActual = geniusResolveAnioActualSeries({
        monthlyData: data,
        anioKey: GENIUS_ANIO_ACTUAL_CSV_KEY,
        ymRows: undefined,
        ymKeys: { yearKey: "Year", monthKey: "Month", valueKey: "NDVI" },
        wall,
    });
    const anioColor = geniusMonthlyAnioColor("ndvi");
    const [minNDVI, maxNDVI] = geniusExpandDomainWithPoints(
        minNDVI0,
        maxNDVI0,
        anioActual.points.map((p) => p.v),
    );
    // Add X axis
    var x = d3.scaleLinear()
        .domain([1, 12]) // Ajustar el dominio al rango de meses
        .range([0, innerWidth]);
    svg.append("g")
        .attr("transform", "translate(0," + innerHeight + ")")
        .call(d3.axisBottom(x).ticks(12).tickFormat(d3.format("d")));

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([minNDVI - 0.01, maxNDVI + 0.01]) // Adjust the domain to add a margin below and above
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
        p25Key: "NDVI_p25",
        p75Key: "NDVI_p75",
        fill: "steelblue",
        fillOpacity: 0.22,
    });

    const tooltip = d3.select("#p03")
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
        .y(d => y(d.NDVI_median))
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
        .attr("cy", d => y(d.NDVI_median))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("pointer-events", "none");

    const hoverClim = data.map((d) => ({
        cx: x(d.Month),
        cy: y(d.NDVI_median),
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
        panelId: "p03",
        innerWidth,
        innerHeight,
        tooltip,
        points: [...hoverClim, ...hoverAnio],
        html: (p) => {
            if (p.kind === "anio") {
                return (
                    `Año actual (${anioActual.year}): ` +
                    p.row.v.toFixed(3) +
                    "<br>Mes: " +
                    p.row.Month
                );
            }
            let h =
                "NDVI (P50): " +
                p.row.NDVI_median.toFixed(2) +
                "<br>Mes: " +
                p.row.Month;
            if (
                p.row.NDVI_p25 != null &&
                p.row.NDVI_p75 != null &&
                !Number.isNaN(p.row.NDVI_p25) &&
                !Number.isNaN(p.row.NDVI_p75)
            ) {
                h +=
                    "<br>P25: " +
                    (+p.row.NDVI_p25).toFixed(2) +
                    " &nbsp; P75: " +
                    (+p.row.NDVI_p75).toFixed(2);
            }
            return h;
        },
    });
}


