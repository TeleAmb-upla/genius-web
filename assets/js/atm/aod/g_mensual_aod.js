import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { geniusTitleForProduct } from '../../map_data_catalog.js';
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
import { geniusFilterAodYearMonthValue } from '../../chart_annual_pctl_band.js';
import { geniusMonthlyAnioColor } from '../../chart_variable_accent.js';
import { geniusBindNearestPointHover } from '../../chart_tooltip_genius.js';

export async function g_m_aod () {
    const container = document.getElementById("p21");
    const { width: outerW, height: outerH, margin: m0 } = getGeniusChartLayout(container);
    const margin = { ...m0, bottom: Math.max(m0.bottom, geniusMonthlyClimMinBottom()) };
    const innerWidth = outerW - margin.left - margin.right;
    const innerHeight = outerH - margin.top - margin.bottom;
    const width = innerWidth;
    const height = innerHeight;

    // Clear any existing SVG
    d3.select("#p21").selectAll("*").remove();

    // Append the svg object to the div with id "p21"
    var svg = d3.select("#p21")
        .append("svg")
        .attr("viewBox", `0 0 ${outerW} ${outerH}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", "translate(" + margin.left + "," + margin.top + ")");

    // Add title
    svg.append("text")
        .attr("x", width / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("font-family", "Arial")
        .attr("class", GENIUS_CHART_HEADING_CLASS)
        .text(geniusTitleForProduct("AOD por mes", "aod"));

   // titulos ejes 
   svg.append("text")
   .attr("text-anchor", "middle")
   .attr("x", width / 2)
   .attr("y", geniusMonthlyClimAxisTitleY(height))
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
   .text("AOD");
   
    const wall = geniusWallCalendarYearMonth();
    const [data, ymRows] = await Promise.all([
        d3.csv(resolveAssetUrl("assets/data/csv/AOD_m_urban.csv")),
        geniusFetchYearMonthCsvOptional(GENIUS_YEARMONTH_CSV.aodUrban),
    ]);

    // P50 = línea; P25–P75 = área (CSV puede traer -9999 como ausencia de dato).
    data.forEach((d) => {
        d.Month = +d.Month;
        d.AOD_median = geniusFilterAodYearMonthValue(geniusParseMonthlyMetric(d.AOD_median));
        d.AOD_p25 = geniusFilterAodYearMonthValue(geniusParseMonthlyMetric(d.AOD_p25));
        d.AOD_p75 = geniusFilterAodYearMonthValue(geniusParseMonthlyMetric(d.AOD_p75));
        const av = geniusParseMonthlyMetric(String(d.anio_actual ?? ""));
        const af = av != null ? geniusFilterAodYearMonthValue(av) : null;
        d.anio_actual = af != null ? String(af) : "";
    });
    const [min0, max0] = geniusMonthlyPctlExtentMulti(data, [
        { mid: "AOD_median", p25: "AOD_p25", p75: "AOD_p75" },
    ]);
    const ymRowsAnio = (ymRows || []).map((r) => {
        const v = geniusFilterAodYearMonthValue(geniusParseMonthlyMetric(r.AOD_median));
        return {
            ...r,
            AOD_median: v != null ? String(v) : "",
        };
    });
    const anioActual = geniusResolveAnioActualSeries({
        monthlyData: data,
        anioKey: GENIUS_ANIO_ACTUAL_CSV_KEY,
        ymRows: ymRowsAnio,
        ymKeys: { yearKey: "Year", monthKey: "Month", valueKey: "AOD_median" },
        wall,
    });
    const anioColor = geniusMonthlyAnioColor("aod");
    const [min, max] = geniusExpandDomainWithPoints(
        min0,
        max0,
        anioActual.points.map((p) => p.v),
    );
    // Add X axis
    var x = d3.scaleLinear()
        .domain([1, 12]) // Ajustar el dominio al rango de meses
        .range([0, width]);
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).ticks(12).tickFormat(d3.format("d")));

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([min - 0.01, max + 0.01]) // Adjust the domain to add a margin below and above
        .range([height, 0]);
    svg.append("g")
        .call(d3.axisLeft(y));

    geniusAppendMonthlyClimatologyLegend(svg, {
        innerWidth,
        innerHeight: height,
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
        p25Key: "AOD_p25",
        p75Key: "AOD_p75",
        fill: "steelblue",
        fillOpacity: 0.22,
    });

    const tooltip = d3.select("#p21")
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
        .defined((d) => d.AOD_median != null)
        .x(d => x(d.Month))
        .y(d => y(d.AOD_median))
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
        .data(data.filter((d) => d.AOD_median != null))
        .enter()
        .append("circle")
        .attr("cx", d => x(d.Month))
        .attr("cy", d => y(d.AOD_median))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("pointer-events", "none");

    const hoverClim = data
        .filter((d) => d.AOD_median != null)
        .map((d) => ({
            cx: x(d.Month),
            cy: y(d.AOD_median),
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
        panelId: "p21",
        innerWidth,
        innerHeight,
        tooltip,
        points: [...hoverClim, ...hoverAnio],
        html: (p) => {
            if (p.kind === "anio") {
                const rv = p.row.v;
                return (
                    `Año actual (${anioActual.year}): ` +
                    (rv != null && Number.isFinite(+rv) ? (+rv).toFixed(2) : "—") +
                    "<br>Mes: " +
                    p.row.Month
                );
            }
            const p50 =
                p.row.AOD_median != null ? p.row.AOD_median.toFixed(2) : "—";
            let h = "AOD (P50): " + p50 + "<br>Mes: " + p.row.Month;
            if (
                p.row.AOD_p25 != null &&
                p.row.AOD_p75 != null &&
                !Number.isNaN(p.row.AOD_p25) &&
                !Number.isNaN(p.row.AOD_p75)
            ) {
                h +=
                    "<br>P25: " +
                    (+p.row.AOD_p25).toFixed(2) +
                    " &nbsp; P75: " +
                    (+p.row.AOD_p75).toFixed(2);
            }
            return h;
        },
    });

}
