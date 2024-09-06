import * as d3 from 'https://cdn.skypack.dev/d3@7';

export async function g_a_hu() {
    // Set the dimensions and margins of the graph
    var margin = { top: 80, right: 10, bottom: 60, left: 100 },
        width = 550 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

    // Clear any existing SVG
    d3.select("#p49").selectAll("*").remove();

    // Append the svg object to the div with id "p49"
    var svg = d3.select("#p49")
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
        .text("Huella Urbana");

    // Titles for axes
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("x", width / 2 + margin.left - 60)
        .attr("y", height + margin.top - 40)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Hectáreas");

    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 60)
        .attr("x", -margin.top - 30)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Años");

    // Parse the Data
    const data = await d3.csv("/assets/csv/Huella_Urbana_Anual.csv");

    // Format the data
    data.forEach(d => {
        d.Year = +d.Year;          // Convert Year to number
        d.Hectareas = +d.Hectareas; // Convert Hectareas to number
    });

    // Define color mapping for each year
    const colorMapping = {
        2023: '#e41a1c', 
        2022: '#377eb8',
        2021: '#4daf4a',
        2020: '#984ea3', 
        2019: '#ff7f00', 
        2018: '#ffff33'  }

    // Add X axis
    var x = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.Hectareas)])
        .range([0, width]);

    // Add Y axis
    var y = d3.scaleBand()
        .domain(data.map(d => d.Year))
        .range([0, height])
        .padding(0.1);


            // Create a tooltip
    const tooltip = d3.select("#p49")
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
    .html("ha: " + d.Hectareas.toFixed(0) + "<br>Mes: " + d.Year)
    .style("left", (event.pageX + 15) + "px")
    .style("top", (event.pageY - 15) + "px");
}

var mouseleave = function (event, d) {
tooltip
    .style("opacity", 0);
d3.select(this)
    .style("stroke", "none");
    
}
    // Add bars
    svg.selectAll("rect")
        .data(data)
        .join("rect")
        .attr("x", 0)
        .attr("y", d => y(d.Year))
        .attr("width", d => x(d.Hectareas))
        .attr("height", y.bandwidth())
        .attr("fill", d => colorMapping[d.Year])
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);
// Use color mapping

    // Add X axis
    svg.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x));

    // Add Y axis
    svg.append("g")
        .call(d3.axisLeft(y));



    return svg.node();
}
