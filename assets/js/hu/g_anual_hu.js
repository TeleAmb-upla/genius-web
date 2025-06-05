import * as d3 from 'https://cdn.skypack.dev/d3@7';

export async function g_a_hu() {

    // Define dimensions and margins
    const container = document.getElementById("p49");
    const width = container ? (container.offsetWidth || 550) : 550;
    const height = container ? (container.offsetHeight || 400) : 400;
    const margin = { top: 40, right: 20, bottom: 40, left: 60 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    // Clear any existing SVG
    d3.select("#p49").selectAll("*").remove();

    // Append the svg object to the div with id "p49"
    var svg = d3.select("#p49")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
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
        .text("Huella Urbana");

    // Titles for axes
    svg.append("text")
        .attr("text-anchor", "end")
        .attr("x", innerWidth / 2)
        .attr("y", innerHeight + 35)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Hectáreas");

    svg.append("text")
        .attr("text-anchor", "end")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 15)
        .attr("x", -innerHeight / 2)
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
        .range([0, innerWidth]);

    // Add Y axis
    var y = d3.scaleBand()
        .domain(data.map(d => d.Year))
        .range([0, innerHeight])
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
    .html("ha: " + d.Hectareas.toFixed(0) + "<br>Año: " + d.Year)
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
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x));

    // Add Y axis
    svg.append("g")
        .call(d3.axisLeft(y));



    return svg.node();
}
