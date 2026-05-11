import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { geniusYearSpanSuffix } from '../../map_data_catalog.js';
import {
    getGeniusChartLayout,
    GENIUS_CHART_HEADING_CLASS,
    geniusAnnualAxisTitleY,
    geniusAnnualSeriesLegendMinBottom,
    geniusConfigureAnnualBandYearAxis,
} from '../../chart_layout_genius.js';
import {
    geniusFetchYearMonthCsvOptional,
    GENIUS_YEARMONTH_CSV,
} from '../../chart_monthly_estado_actual.js';
import {
    geniusApplyUrbanAnnualMedianIntraAnnualBand,
    geniusAnnualRowsWithFiniteMedian,
    geniusAnnualPctlYExtent,
    geniusAppendAnnualPctlBand,
    geniusAppendAnnualSeriesLegend,
} from '../../chart_annual_pctl_band.js';
import { geniusBindNearestPointHover } from '../../chart_tooltip_genius.js';

export async function g_a_no2(containerId = "p29") {
    // Get container dimensions
    const container = document.getElementById(containerId);
    const { width, height, margin: m0 } = getGeniusChartLayout(container);
    const margin = {
        ...m0,
        bottom: Math.max(m0.bottom, geniusAnnualSeriesLegendMinBottom()),
    };
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
                `NO<tspan baseline-shift="sub">2</tspan> Interanual Urbano de Quilpué${geniusYearSpanSuffix('no2')}`,
        );

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
        .html(() => `
        NO<tspan baseline-shift="sub">2</tspan>
    `);

    // Parse the Data
    const [data, ymRows] = await Promise.all([
        d3.csv(resolveAssetUrl("assets/data/csv/NO2_y_urban.csv")),
        geniusFetchYearMonthCsvOptional(GENIUS_YEARMONTH_CSV.no2Urban),
    ]);

    // Format the data
    data.forEach(d => {
        d.Year = +d.Year;
        d.NO2_median = +d.NO2_median;
    });
    geniusApplyUrbanAnnualMedianIntraAnnualBand(data, ymRows, {
        ymValueKey: "NO2_median",
        medianKey: "NO2_median",
        p25Key: "NO2_p25",
        p75Key: "NO2_p75",
    });
    const [min, max] = geniusAnnualPctlYExtent(
        data,
        "NO2_median",
        "NO2_p25",
        "NO2_p75",
    );

    // Add X axis
    var x = d3.scaleBand()
        .domain(data.map(d => d.Year))
        .range([0, innerWidth]);

    const xAxisG = svg.append("g").attr(
        "transform",
        "translate(0," + innerHeight + ")",
    );
    geniusConfigureAnnualBandYearAxis(xAxisG, x);

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([min - 0.01, max + 0.01])
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
        p25Key: "NO2_p25",
        p75Key: "NO2_p75",
        fill: "steelblue",
    });

    const annualDefined = geniusAnnualRowsWithFiniteMedian(data, "NO2_median");

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
        .x(d => x(d.Year) + x.bandwidth() / 2)
        .defined(
            (d) =>
                d.NO2_median != null &&
                d.NO2_median !== "" &&
                Number.isFinite(+d.NO2_median),
        )
        .y(d => y(d.NO2_median))
        .curve(d3.curveCatmullRom.alpha(0.5));

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
        .attr("cy", d => y(d.NO2_median))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("pointer-events", "none");

    geniusBindNearestPointHover(svg, {
        panelId: containerId,
        innerWidth,
        innerHeight,
        tooltip,
        points: annualDefined.map((d) => ({
            cx: x(d.Year) + x.bandwidth() / 2,
            cy: y(d.NO2_median),
            row: d,
        })),
        html: (p) => {
            const r = p.row;
            let s =
                "NO² : " +
                (r.NO2_median != null &&
                r.NO2_median !== "" &&
                Number.isFinite(+r.NO2_median)
                    ? (+r.NO2_median).toFixed(2)
                    : "—") +
                "<br>Año: " +
                r.Year;
            if (
                r.NO2_p25 != null &&
                r.NO2_p75 != null &&
                Number.isFinite(+r.NO2_p25) &&
                Number.isFinite(+r.NO2_p75)
            ) {
                s +=
                    "<br>P25–P75: " +
                    (+r.NO2_p25).toFixed(2) +
                    " – " +
                    (+r.NO2_p75).toFixed(2);
            }
            return s;
        },
    });
}
