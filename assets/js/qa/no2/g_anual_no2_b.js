import * as d3 from 'https://cdn.skypack.dev/d3@7';

export async function g_a_no2_b(containerId = "p32") {
    // Get container dimensions
    const container = document.getElementById(containerId);
    const width = container.offsetWidth || 550;
    const height = container.offsetHeight || 400;
    const margin = { top: 80, right: 10, bottom: 60, left: 100 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear any existing SVG
    d3.select(`#${containerId}`).selectAll("*").remove();

    // Append the svg object to the div with id containerId
    var svg = d3.select(`#${containerId}`)
        .append("svg")
        .attr("width", width)
        .attr("height", height)
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
        .html(() => `
            NO<tspan baseline-shift="sub">2</tspan> Interanual Urbano de Quilpué
        `);

    // Titles for axes
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("x", innerWidth / 2 + margin.left - 60)
        .attr("y", innerHeight + margin.top - 40)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Años");

    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 60)
        .attr("x", -margin.top - 30)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .html(() => `
        NO<tspan baseline-shift="sub">2</tspan>
    `);

    // Parse the Data
    const data = await d3.csv("/assets/csv/NO2_Anual_Comunal.csv");

    // Format the data
    data.forEach(d => {
        d.Year = +d.Year;
        d.NO2_median_fixed = +d.NO2_median_fixed;
    });

    // Find the minimum and maximum NO2_median_fixed values
    const minNDVI = d3.min(data, d => d.NO2_median_fixed);
    const maxNDVI = d3.max(data, d => d.NO2_median_fixed);

    // Add X axis
    var x = d3.scaleBand()
        .domain(data.map(d => d.Year))
        .range([0, innerWidth]);

    svg.append("g")
        .attr("transform", "translate(0," + innerHeight + ")")
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([minNDVI - 0.01, maxNDVI + 0.01])
        .range([innerHeight, 0]);
    svg.append("g")
        .call(d3.axisLeft(y));

    // Create a tooltip
    const tooltip = d3.select(`#${containerId}`)
        .append("div")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px")
        .style("position", "absolute");

    // Mouseover, mousemove, and mouseleave functions
    var mouseover = function (event, d) {
        tooltip
            .style("opacity", 1);
        d3.select(this)
            .style("stroke", "black")
            .style("opacity", 1);
    }

    var mousemove = function (event, d) {
        tooltip
            .html("NO²: " + d.NO2_median_fixed.toFixed(2) + "<br>Año: " + d.Year)
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 15) + "px");
    }

    var mouseleave = function (event, d) {
        tooltip
            .style("opacity", 0);
        d3.select(this)
            .style("stroke", "none");
    }

    // Add the line with smoothing and animation
    var line = d3.line()
        .x(d => x(d.Year) + x.bandwidth() / 2)
        .y(d => y(d.NO2_median_fixed))
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

    // Add larger, invisible circles for better mouse interaction
    svg.append("g")
        .selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.Year) + x.bandwidth() / 2)
        .attr("cy", d => y(d.NO2_median_fixed))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("pointer-events", "all")
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);
}
