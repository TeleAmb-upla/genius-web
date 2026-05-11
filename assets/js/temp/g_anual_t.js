import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { geniusTitleForProduct } from '../map_data_catalog.js';
import {
    getGeniusChartLayout,
    GENIUS_CHART_HEADING_CLASS,
    geniusAnnualAxisTitleY,
    geniusAnnualSeriesLegendMinBottom,
    geniusConfigureAnnualBandYearAxis,
} from '../chart_layout_genius.js';
import {
    geniusFetchYearMonthCsvOptional,
    GENIUS_YEARMONTH_CSV,
} from '../chart_monthly_estado_actual.js';
import {
    geniusApplyLstUrbanAnnualMedianIntraAnnualBand,
    geniusAnnualPctlYExtent,
    geniusAppendAnnualPctlBand,
    geniusAppendAnnualSeriesLegend,
} from '../chart_annual_pctl_band.js';
import { geniusBindNearestPointHover } from '../chart_tooltip_genius.js';

export async function g_a_t() {
    // Clear any existing SVG
    d3.select("#p11").selectAll("*").remove();

    // Define width and height based on container or fallback
    const container = document.getElementById("p11");
    const { width, height, margin: m0 } = getGeniusChartLayout(container);
    const margin = {
        ...m0,
        bottom: Math.max(m0.bottom, geniusAnnualSeriesLegendMinBottom()),
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Append the svg object to the div with id "p11"
    var svg = d3.select("#p11")
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
        .text(geniusTitleForProduct("Temperatura por año", "lst"));

    // Titles for axes
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", innerWidth / 2)
        .attr("y", geniusAnnualAxisTitleY(innerHeight))
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Años");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -Math.max(42, Math.round(margin.left * 0.78)))
        .attr("x", -innerHeight / 2)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("LST (C°)");

    const [data, ymRows] = await Promise.all([
        d3.csv(resolveAssetUrl("assets/data/csv/LST_y_urban.csv")),
        geniusFetchYearMonthCsvOptional(GENIUS_YEARMONTH_CSV.lstUrban),
    ]);

    data.forEach((d) => {
        d.Year = +d.Year;
    });
    geniusApplyLstUrbanAnnualMedianIntraAnnualBand(data, ymRows);
    let [minNDVI, maxNDVI] = geniusAnnualPctlYExtent(
        data,
        "LST_median",
        "LST_p25",
        "LST_p75",
    );
    // Añadir eje X
    var x = d3.scaleBand()
        .domain(data.map(d => d.Year))
        .range([0, innerWidth]);

    const xAxisG = svg.append("g").attr(
          "transform", `translate(0,${innerHeight})`);
    geniusConfigureAnnualBandYearAxis(xAxisG, x); // Rotar -75 grados
        // Add Y axis
        var y = d3.scaleLinear()
            .domain([minNDVI - 0.01, maxNDVI + 0.01]) // Adjust the domain to add a margin below and above
            .range([innerHeight, 0]);
        svg.append("g")
            .call(d3.axisLeft(y));

    geniusAppendAnnualSeriesLegend(svg, {
        innerHeight,
        lineColor: "steelblue",
        bandFillColor: "steelblue",
        medianLabel: "Mediana anual (intra-anual)",
    });

    geniusAppendAnnualPctlBand(svg, {
        data,
        xBand: x,
        yearKey: "Year",
        y,
        p25Key: "LST_p25",
        p75Key: "LST_p75",
        fill: "steelblue",
    });

    const annualDefined = data.filter(
        (d) => d.LST_median != null && Number.isFinite(d.LST_median),
    );

    const tooltip = d3.select("#p11")
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
    .x(d => x(d.Year) + x.bandwidth() / 2) // Ensure the line passes through the center of the band
    .defined(d => d.LST_median != null && Number.isFinite(d.LST_median))
    .y(d => y(d.LST_median))
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

    svg.append("g")
        .selectAll("circle")
        .data(annualDefined)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.Year) + x.bandwidth() / 2)
        .attr("cy", d => y(d.LST_median))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("pointer-events", "none");

    geniusBindNearestPointHover(svg, {
        panelId: "p11",
        innerWidth,
        innerHeight,
        tooltip,
        points: annualDefined.map((d) => ({
            cx: x(d.Year) + x.bandwidth() / 2,
            cy: y(d.LST_median),
            row: d,
        })),
        html: (p) => {
            const r = p.row;
            let s =
                "Mediana: " +
                (r.LST_median != null && Number.isFinite(r.LST_median)
                    ? r.LST_median.toFixed(2)
                    : "—") +
                " °C<br>Año: " +
                r.Year;
            if (
                r.LST_p25 != null &&
                r.LST_p75 != null &&
                Number.isFinite(+r.LST_p25) &&
                Number.isFinite(+r.LST_p75)
            ) {
                s +=
                    "<br>P25–P75: " +
                    (+r.LST_p25).toFixed(2) +
                    " – " +
                    (+r.LST_p75).toFixed(2);
            }
            return s;
        },
    });

}
