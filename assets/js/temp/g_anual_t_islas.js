import * as d3 from 'https://cdn.skypack.dev/d3@7';

export async function g_a_t_islas(containerId = "p72") {
    // Define width and height based on container or fallback
    const container = document.getElementById(containerId);
    const width = container.offsetWidth || 550;
    const height = container.offsetHeight || 400;
    const margin = { top: 40, right: 20, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear any existing SVG
    d3.select("#p72").selectAll("*").remove();

    // Append the svg object to the div with id "p72"
    var svg = d3.select("#p72")
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
        .text("LST Interanual Área Urbana");

    // Titles for axes
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 40)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Años");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 15)
        .attr("x", -innerHeight / 2)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("LST (C°)");

    // Parse the Data
    const data = await d3.csv("/assets/csv/LST_y_urban.csv");

    // Format the data
    data.forEach(d => {
        d.Year = +d.Year;
        d.LST_mean = +d.LST_mean;
    });

    // Find the minimum and maximum LST_mean values
    const minNDVI = d3.min(data, d => d.LST_mean);
    const maxNDVI = d3.max(data, d => d.LST_mean);

    // Añadir eje X
    var x = d3.scaleBand()
        .domain(data.map(d => d.Year))
        .range([0, innerWidth]);

    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")))
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("dx", "-.8em")
        .attr("dy", ".15em")
        .attr("transform", "rotate(-75)");

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([minNDVI - 0.01, maxNDVI + 0.01])
        .range([innerHeight, 0]);
    svg.append("g")
        .call(d3.axisLeft(y));

    // Create a tooltip
    const tooltip = d3.select("#p72")
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
            .html("LST: " + d.LST_mean.toFixed(2) + "<br>Año: " + d.Year)
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
        .y(d => y(d.LST_mean))
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
        .attr("cx", d => x(d.Year) + x.bandwidth() / 2)
        .attr("cy", d => y(d.LST_mean))
        .attr("r", 4)
        .attr("fill", "steelblue")
        .attr("pointer-events", "all")
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);
}
