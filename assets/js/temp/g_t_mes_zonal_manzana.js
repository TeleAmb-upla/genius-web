import * as d3 from 'https://cdn.skypack.dev/d3@7';

export async function g_t_m_z_m(containerId = "p18") {
    // Define width and height based on container or fallback
    const container = document.getElementById(containerId);
    const width = container.offsetWidth || 550;
    const height = container.offsetHeight || 400;
    const margin = { top: 40, right: 20, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear any existing SVG
    d3.select("#p18").selectAll("*").remove();

    // Append the svg object to the div with id "p18"
    var svg = d3.select("#p18")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
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
        .text("LST Intraanual Área Urbana");

    // titulos ejes 
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 40)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Meses");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 15)
        .attr("x", -innerHeight / 2)
        .style("font-family", "Arial")
        .style("font-size", "12px") 
        .text("LST (C°)");

    // Parse the Data
    const data = await d3.csv("/assets/csv/LST_Mensual.csv");

    // Format the data
    data.forEach(d => {
        d.Month = +d.Month;
        d.LST_median = +d.LST_median;
    });

    // Find the minimum and maximum LST_median values
    const min = d3.min(data, d => d.LST_median);
    const max = d3.max(data, d => d.LST_median);

    // Add X axis
    var x = d3.scaleLinear()
        .domain([1, 12])
        .range([0, innerWidth]);
    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(12).tickFormat(d3.format("d")));

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([min - 0.01, max + 0.01])
        .range([innerHeight, 0]);
    svg.append("g")
        .call(d3.axisLeft(y));

    // Create a tooltip
    const tooltip = d3.select("#p18")
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
            .html("LST: " + d.LST_median.toFixed(2) + "<br>Mes: " + d.Month)
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
        .x(d => x(d.Month))
        .y(d => y(d.LST_median))
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

    // Add points
    svg.append("g")
        .selectAll("circle")
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", d => x(d.Month))
        .attr("cy", d => y(d.LST_median))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("pointer-events", "all")
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);
}
