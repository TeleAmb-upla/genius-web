import * as d3 from 'https://cdn.skypack.dev/d3@7';

export async function g_m_ndvi_stdev() {
    // Set the dimensions and margins of the graph
    var margin = { top: 80, right: 10, bottom: 60, left: 100 },
        width = 550 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

    // Clear any existing SVG
    d3.select("#p69").selectAll("*").remove();

    // Append the svg object to the div with id "p69"
    var svg = d3.select("#p69")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
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
        .text("NDVI Intranual Área Verdes Promedio");

    // Add axis labels
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("x", width / 2 + margin.left - 60)
        .attr("y", height + margin.top - 40)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Meses");

    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 60)
        .attr("x", -margin.top - 30)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("NDVI");

    // Parse the Data
    const data = await d3.csv("/assets/csv/NDVI_Monthly_AV.csv");

    // Format the data
    data.forEach(d => {
        d.Month = +d.Month;
        d.NDVI_Urbano = +d.NDVI_Urbano;
        d.NDVI_Gestion = +d.NDVI_Gestion;
        d.NDVI_Planificacion = +d.NDVI_Planificacion;
    });

    // Find the minimum and maximum NDVI values across all columns
    const minNDVI = d3.min(data, d => Math.min(d.NDVI_Urbano, d.NDVI_Gestion, d.NDVI_Planificacion));
    const maxNDVI = d3.max(data, d => Math.max(d.NDVI_Urbano, d.NDVI_Gestion, d.NDVI_Planificacion));

    // Add X axis using scaleBand for padding
    var x = d3.scaleBand()
        .domain(data.map(d => d.Month))
        .range([0, width])
        .padding(0.1); // Add padding to center the data points away from the Y axis

    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([minNDVI - 0.01, maxNDVI + 0.01])
        .range([height, 0]);

    svg.append("g")
        .call(d3.axisLeft(y));

    // Add legend below the title
    const legendData = [
        { label: "NDVI Urbano", color: "steelblue" },
        { label: "NDVI Gestión", color: "green" },
        { label: "NDVI Planificación", color: "orange" }
    ];

    // Calculate total width of the legend to center it
    const legendWidth = legendData.length * 120 - 20;

    const legend = svg.append("g")
        .attr("transform", `translate(${(width - legendWidth) / 2}, ${-margin.top / 2 + 20})`);

    legend.selectAll("rect")
        .data(legendData)
        .enter()
        .append("rect")
        .attr("x", (d, i) => i * 120)
        .attr("y", 0)
        .attr("width", 15)
        .attr("height", 15)
        .attr("fill", d => d.color);

    legend.selectAll("text")
        .data(legendData)
        .enter()
        .append("text")
        .attr("x", (d, i) => i * 120 + 20)
        .attr("y", 12)
        .style("font-size", "12px")
        .style("font-family", "Arial")
        .text(d => d.label);

    // Line generator function
    const colors = {
        NDVI_Urbano: "steelblue",
        NDVI_Gestion: "green",
        NDVI_Planificacion: "orange"
    };

    // Draw the lines
    Object.keys(colors).forEach(key => {
        var lineGen = d3.line()
            .x(d => x(d.Month) + x.bandwidth() / 2) // Center the line within the band
            .y(d => y(d[key]))
            .curve(d3.curveCatmullRom.alpha(0.5));

        svg.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", colors[key])
            .attr("stroke-width", 1.5)
            .attr("d", lineGen);
    });

    // Create tooltips
    const tooltip = d3.select("#p69")
        .append("div")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px")
        .style("position", "absolute");

    // Mouse events for tooltips
    var mouseover = function (event, d) {
        tooltip.style("opacity", 1);
    };

    var mousemove = function (event, d) {
        tooltip.html(
            "Mes: " + d.Month +
            "<br>NDVI Urbano: " + d.NDVI_Urbano.toFixed(2) +
            "<br>NDVI Gestión: " + d.NDVI_Gestion.toFixed(2) +
            "<br>NDVI Planificación: " + d.NDVI_Planificacion.toFixed(2)
        )
            .style("left", (event.pageX + 15) + "px")
            .style("top", (event.pageY - 15) + "px");
    };

    var mouseleave = function (event, d) {
        tooltip.style("opacity", 0);
    };

    // Add points for each data series
    ["NDVI_Urbano", "NDVI_Gestion", "NDVI_Planificacion"].forEach(key => {
        svg.append("g")
            .selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.Month) + x.bandwidth() / 2) // Center the circle within the band
            .attr("cy", d => y(d[key]))
            .attr("r", 4)
            .attr("fill", colors[key])
            .attr("pointer-events", "all")
            .on("mouseover", mouseover)
            .on("mousemove", mousemove)
            .on("mouseleave", mouseleave);
    });
}
