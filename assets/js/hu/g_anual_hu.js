import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { geniusTitleForProduct } from '../map_data_catalog.js';
import { getGeniusChartLayout, GENIUS_CHART_HEADING_CLASS } from '../chart_layout_genius.js';
import { geniusBindNearestPointHover } from '../chart_tooltip_genius.js';

export async function g_a_hu() {

    // Define dimensions and margins
    const container = document.getElementById("p49");
    const { width, height, margin } = getGeniusChartLayout(container);
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear any existing SVG
    d3.select("#p49").selectAll("*").remove();

    // Append the svg object to the div with id "p49"
    var svg = d3.select("#p49")
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Add title
    svg.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("font-family", "Arial")
        .attr("class", GENIUS_CHART_HEADING_CLASS)
        .text(geniusTitleForProduct("Huella urbana por año", "hu"));

    // Titles for axes
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + Math.max(32, margin.bottom * 0.65))
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Hectáreas (ha)");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -Math.max(42, Math.round(margin.left * 0.78)))
        .attr("x", -innerHeight / 2)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Años");

    // Parse the Data
    const data = await d3.csv(resolveAssetUrl("assets/data/csv/Huella_Urbana_Anual.csv"));

    // Format the data
    data.forEach(d => {
        d.Year = +d.Year;          // Convert Year to number
        d.Hectareas = +d.Hectareas; // Convert Hectareas to number
    });

    // Define color mapping for each year
    const colorMapping = {
        2026: '#999999',
        2025: '#f781bf',
        2024: '#a65628',
        2023: '#e41a1c', 
        2022: '#377eb8',
        2021: '#4daf4a',
        2020: '#984ea3', 
        2019: '#ff7f00', 
        2018: '#ffff33'  }

    // Add X axis
    var x = d3.scaleLinear()
        .domain([1000, d3.max(data, d => d.Hectareas) * 1.02])
        .range([0, innerWidth]);

    // Add Y axis
    var y = d3.scaleBand()
        .domain(data.map(d => d.Year))
        .range([0, innerHeight])
        .padding(0.1);


    const tooltip = d3.select("#p49")
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

    svg.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", 0)
        .attr("y", (d) => y(d.Year))
        .attr("width", (d) => x(d.Hectareas))
        .attr("height", y.bandwidth())
        .attr("fill", (d) => colorMapping[d.Year])
        .attr("pointer-events", "none");
// Use color mapping

    // Add X axis
    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x));

    svg.append("g").call(d3.axisLeft(y));

    geniusBindNearestPointHover(svg, {
        panelId: "p49",
        innerWidth,
        innerHeight,
        tooltip,
        points: data.map((d) => ({
            cx: x(d.Hectareas) / 2,
            cy: y(d.Year) + y.bandwidth() / 2,
            row: d,
            color: colorMapping[d.Year],
        })),
        html: (p) =>
            "Superficie: " +
            p.row.Hectareas.toFixed(0) +
            " ha<br>Año: " +
            p.row.Year,
    });

    return svg.node();
}
