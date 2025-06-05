import * as d3 from 'https://cdn.skypack.dev/d3@7';

export async function g_m_hu() {
    // Clear any existing SVG
    d3.select("#p48").selectAll("*").remove();

    // Define dimensions and margins
    const container = document.getElementById("p48");
    const width = container ? (container.offsetWidth || 550) : 550;
    const height = container ? (container.offsetHeight || 400) : 400;
    const margin = { top: 40, right: 20, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Append the svg object to the div with id "p48"
    var svg = d3.select("#p48")
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
        .text("Huella Urbana interanual Área Urbana");

    // Títulos de los ejes
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 35)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Años");

    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 15)
        .attr("x", -innerHeight / 2)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Huella Urbana");

    // Definir un patrón SVG para el rayado diagonal
    svg.append("defs")
        .append("pattern")
        .attr("id", "diagonalHatch")
        .attr("patternUnits", "userSpaceOnUse")
        .attr("width", 4)
        .attr("height", 4)
        .append("path")
        .attr("d", "M-1,1 l2,-2 M0,4 l4,-4 M3,5 l2,-2")  // Define las líneas diagonales
        .attr("stroke", "#808080")  // Color de las líneas
        .attr("stroke-width", 1);

    // Parse the Data
    const data = await d3.csv("/assets/csv/Areas_Huella_Urbana_Yearly.csv");

    // Convert Year to integer and parse other values to numbers
    data.forEach(d => {
        d.Year = parseInt(d.Year);
        d.Area_DentroPRC = +d.Area_DentroPRC;
        d.Area_FueraPRC = +d.Area_FueraPRC;
        d.Precision_Kappa = +d.Precision_Kappa;  // Aunque no se usa en el gráfico, lo mantenemos para el tooltip
    });

    // Definir colores por año para Area_DentroPRC
    const colorPorAno = {
        2023: '#e41a1c',
        2022: '#377eb8',
        2021: '#4daf4a',
        2020: '#984ea3',
        2019: '#ff7f00',
        2018: '#ffff33'
    };

    // List of subgroups (stacked categories)
    var subgroups = ["Area_DentroPRC", "Area_FueraPRC"];

    // List of groups (years)
    var groups = d3.map(data, d => d.Year);

    // Add X axis
    var x = d3.scaleBand()
        .domain(groups)
        .range([0, innerWidth])
        .padding([0.2]);
    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).tickFormat(d3.format("d")).tickSize(0));  // Formatear las etiquetas como enteros

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([0, d3.max(data, d => +d.Area_DentroPRC + +d.Area_FueraPRC) * 1.1])  // Consideramos solo las áreas para el eje Y
        .range([innerHeight, 0]);
    svg.append("g")
        .call(d3.axisLeft(y));

    // stack the data
    var stackedData = d3.stack()
        .keys(subgroups)
        (data);

    // Tooltip div
    var tooltip = d3.select("#p48")
        .append("div")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "1px")
        .style("border-radius", "5px")
        .style("padding", "10px")
        .style("position", "absolute");

    // Tooltip mouseover event handler
    var mouseover = function(event, d) {
        tooltip.style("opacity", 1);
        d3.select(this)
            .style("stroke", "black")  // Agregar borde negro
            .style("stroke-width", 2);  // Hacer el borde más grueso
    }

    // Tooltip mousemove event handler
    var mousemove = function(event, d) {
        // Asegurarse de que se está accediendo correctamente a los datos del círculo
        tooltip
            .html("Año: " + d.Year + "<br>Área Dentro PRC: " + d.Area_DentroPRC
                + "<br>Área Fuera PRC: " + d.Area_FueraPRC + "<br>Precision Kappa: " + d.Precision_Kappa)
            .style("left", (event.pageX + 10) + "px")  // Ajusta la posición del tooltip
            .style("top", (event.pageY - 28) + "px");
    }

    // Tooltip mouseleave event handler
    var mouseleave = function(event, d) {
        tooltip.style("opacity", 0);
        d3.select(this)
            .style("stroke", "none")  // Quitar borde negro
            .style("stroke-width", 0);  // Quitar grosor de borde
    }

    // Show the bars with conditional coloring
    svg.append("g")
        .selectAll("g")
        .data(stackedData)
        .enter().append("g")
        .attr("fill", function(d) {
            // Definir color o patrón basado en el subgrupo
            return d.key === "Area_DentroPRC" ? colorPorAno[d3.select(this).datum().key] : "url(#diagonalHatch)";
        })
        .selectAll("rect")
        .data(d => d)
        .enter().append("rect")
        .attr("x", d => x(d.data.Year))
        .attr("y", d => y(d[1]))
        .attr("height", d => y(d[0]) - y(d[1]))
        .attr("width", x.bandwidth())
        .attr("fill", function(d) {
            const parentKey = d3.select(this.parentNode).datum().key; // Acceso a la clave del subgrupo
            return parentKey === "Area_DentroPRC" ? colorPorAno[d.data.Year] : "url(#diagonalHatch)";
        })
        .on("mouseover", mouseover)  // Evento para resaltar la barra y mostrar tooltip
        .on("mousemove", function(event, d) {
            // Tooltip para las barras (rectángulos)
            tooltip
                .html("Año: " + d.data.Year + "<br>Area DentroPRC: " + d.data.Area_DentroPRC
                    + "<br>Area FueraPRC: " + d.data.Area_FueraPRC + "<br>Precision Kappa: " + d.data.Precision_Kappa)
                .style("left", (event.pageX + 10) + "px")  // Ajusta la posición del tooltip
                .style("top", (event.pageY - 28) + "px");
        })
        .on("mouseleave", mouseleave);  // Evento para quitar resaltado y esconder tooltip

    // Line to connect points
    var line = d3.line()
        .x(d => x(d.Year) + x.bandwidth() / 2)  // Center the point in the middle of the bar
        .y(d => y(d.Area_DentroPRC + d.Area_FueraPRC));  // Position the point above the stack

    svg.append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "black")
        .attr("stroke-width", 1.5)
        .attr("d", line);

    // Add black points above each bar
    svg.selectAll("circle")
        .data(data)
        .enter().append("circle")
        .attr("cx", d => x(d.Year) + x.bandwidth() / 2)  // Center the point in the middle of the bar
        .attr("cy", d => y(d.Area_DentroPRC + d.Area_FueraPRC))  // Position the point above the stack
        .attr("r", 4)
        .attr("fill", "black")
        .on("mouseover", mouseover)  // Evento para mostrar tooltip
        .on("mousemove", mousemove)  // Evento para mover tooltip
        .on("mouseleave", mouseleave);  // Evento para esconder tooltip

    // Legend group
    var legendGroup = svg.append("g")
        .attr("transform", `translate(${innerWidth / 2 - 100}, ${-margin.top / 2 + 20})`);

    // Legend for "Área Fuera PRC"
    legendGroup.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 12)  // Size of the rectangle
        .attr("height", 12)  // Size of the rectangle
        .style("fill", "url(#diagonalHatch)");

    legendGroup.append("text")
        .attr("x", 16)  // Positioned right after the rectangle
        .attr("y", 10)
        .attr("text-anchor", "start")
        .style("font-size", "10px")  // Smaller font size
        .style("font-family", "Arial")
        .text("Área Fuera PRC");


    // Adjust position to move the second legend further to the right
    var secondLegendX = 100;  // Adjust this value to move further to the right

    // Create a group for the legend box with triangles next to "Área Fuera PRC"
    legendGroup.append("rect")
        .attr("x", secondLegendX)  // Positioned further right
        .attr("y", 0)
        .attr("width", 12)  // Size of the small legend box
        .attr("height", 12)  // Size of the small legend box
        .attr("stroke", "black")
        .attr("fill", "none");

    // Define the coordinates for the triangular sections within the 12x12 square
    var smallTriangles = [
        { points: `${secondLegendX},0 ${secondLegendX + 6},3 ${secondLegendX},12`, color: '#e41a1c' },  // Left triangle
        { points: `${secondLegendX + 12},0 ${secondLegendX + 6},3 ${secondLegendX + 12},12`, color: '#377eb8' },  // Right triangle
        { points: `${secondLegendX},0 ${secondLegendX + 6},0 ${secondLegendX + 6},3`, color: '#4daf4a' },  // Top left triangle
        { points: `${secondLegendX + 6},0 ${secondLegendX + 12},0 ${secondLegendX + 6},3`, color: '#984ea3' },  // Top right triangle
        { points: `${secondLegendX},12 ${secondLegendX + 6},3 ${secondLegendX + 6},12`, color: '#ff7f00' },  // Bottom left triangle
        { points: `${secondLegendX + 6},3 ${secondLegendX + 12},12 ${secondLegendX + 6},12`, color: '#ffff33' }  // Bottom right triangle
    ];

    // Add the triangular sections to the legend
    smallTriangles.forEach(function(triangle) {
        legendGroup.append("polygon")
            .attr("points", triangle.points)
            .attr("fill", triangle.color)
            .attr("stroke", "black");
    });

    // Add the text for the triangle legend
    legendGroup.append("text")
        .attr("x", secondLegendX + 16)  // Positioned further right after the small legend box
        .attr("y", 10)
        .attr("text-anchor", "start")
        .style("font-size", "10px")
        .style("font-family", "Arial")
        .text("Área Dentro PRC por Año");

}
