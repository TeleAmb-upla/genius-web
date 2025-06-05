import * as d3 from 'https://cdn.skypack.dev/d3@7';

export async function g_a_ndvi_stdev() {
    // Usa el tamaño del contenedor definido por CSS
    const container = document.getElementById("p68");
    const width = container.offsetWidth || 550;
    const height = container.offsetHeight || 400;
    const margin = { top: 40, right: 20, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;
    // Clear any existing SVG
    d3.select("#p68").selectAll("*").remove();

    // Append the svg object to the div with id "p68"
    var svg = d3.select("#p68")
        .append("svg")
        .attr("width", "100%")
        .attr("height", "100%")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet");

    // Add title
    svg.append("text")
        .attr("x", width * 0.5)
        .attr("y", 30)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("font-family", "Arial")
        .text("NDVI Interanual Áreas Verdes Promedio");

    // Add legend below the title
    const legendData = [
        { label: "NDVI Urbano", color: "steelblue" },
        { label: "NDVI Gestión", color: "green" },
        { label: "NDVI Planificación", color: "orange" }
    ];
    const legendWidth = legendData.length * 120 - 20;
    const legend = svg.append("g")
        .attr("transform", `translate(${(width - legendWidth) / 2}, 50)`);

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

    // Eje X label
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width * 0.5)
        .attr("y", height - 10)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Años");

    // Eje Y label
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height * 0.5)
        .attr("y", 15)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("NDVI");








        
    // Parse the data
    const data = await d3.csv("/assets/csv/NDVI_y_av.csv");

    data.forEach(d => {
        d.Year = +d.Year;
        d.NDVI_Urbano = +d.NDVI_Urbano;
        d.NDVI_Gestion = +d.NDVI_Gestion;
        d.NDVI_Planificacion = +d.NDVI_Planificacion;
    });

    // Find the minimum and maximum NDVI values across all columns
    const minNDVI = d3.min(data, d => Math.min(d.NDVI_Urbano, d.NDVI_Gestion, d.NDVI_Planificacion));
    const maxNDVI = d3.max(data, d => Math.max(d.NDVI_Urbano, d.NDVI_Gestion, d.NDVI_Planificacion));

    // Ejes (deja espacio para labels)
    const left = 60, right = 30, top = 80, bottom = 40;
    const plotWidth = width - left - right;
    const plotHeight = height - top - bottom;

    // Add X axis
    var x = d3.scaleBand()
        .domain(data.map(d => d.Year))
        .range([left, left + plotWidth])
        .padding(0.2);

    svg.append("g")
        .attr("transform", `translate(0,${top + plotHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")));

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([minNDVI - 0.01, maxNDVI + 0.01])
        .range([top + plotHeight, top]);

    svg.append("g")
        .attr("transform", `translate(${left},0)`)
        .call(d3.axisLeft(y));

    // Define colors for each line
    const colors = {
        NDVI_Urbano: "steelblue",
        NDVI_Gestion: "green",
        NDVI_Planificacion: "orange"
    };

    // Draw the lines
    Object.keys(colors).forEach(key => {
        var lineGen = d3.line()
            .x(d => x(d.Year) + x.bandwidth() / 2)
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
    const tooltip = d3.select("#p68")
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
            "Año: " + d.Year +
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

    // Add circles for each data point
    ["NDVI_Urbano", "NDVI_Gestion", "NDVI_Planificacion"].forEach(key => {
        svg.append("g")
            .selectAll("circle")
            .data(data)
            .enter()
            .append("circle")
            .attr("cx", d => x(d.Year) + x.bandwidth() / 2)
            .attr("cy", d => y(d[key]))
            .attr("r", 4)
            .attr("fill", colors[key])
            .attr("pointer-events", "all")
            .on("mouseover", mouseover)
            .on("mousemove", mousemove)
            .on("mouseleave", mouseleave);
    });
}
