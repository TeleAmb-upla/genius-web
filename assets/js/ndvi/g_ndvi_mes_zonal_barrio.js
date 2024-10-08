import * as d3 from 'https://cdn.skypack.dev/d3@7';

export async function g_ndvi_m_z_b() {
    // Set the dimensions and margins of the graph
    var margin = { top: 80, right: 10, bottom: 60, left: 100 },
        width = 550 - margin.left - margin.right,
        height = 400 - margin.top - margin.bottom;

    // Clear any existing SVG
    d3.select("#p06").selectAll("*").remove();

    // Append the svg object to the div with id "p06"
    var svg = d3.select("#p06")
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
        .text("NDVI Intranual Distrito Urbano");

   // titulos ejes 
   svg.append("text")
   .attr("text-anchor", "end")
   .attr("x", width / 2 + margin.left + -60)
   .attr("y", height + margin.top + -40)
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
    const data = await d3.csv("/assets/csv/NDVI_Monthly_ZonalStats_Barrios.csv");

    // Format the data
    data.forEach(d => {
        d.Month = +d.Month;           // Convert Month to number
        d.NDVI = +d.NDVI;    // Convert NDVI to number
    });
    // Find the minimum and maximum NDVI values
    const minNDVI = d3.min(data, d => d.NDVI);
    const maxNDVI = d3.max(data, d => d.NDVI);
    // Add X axis
    var x = d3.scaleLinear()
        .domain([1, 12]) // Ajustar el dominio al rango de meses
        .range([0, width]);
    svg.append("g")
        .attr("transform", "translate(0," + height + ")")
        .call(d3.axisBottom(x).ticks(12).tickFormat(d3.format("d")));

    // Add Y axis
    var y = d3.scaleLinear()
        .domain([minNDVI - 0.01, maxNDVI + 0.01]) // Adjust the domain to add a margin below and above
        .range([height, 0]);
    svg.append("g")
        .call(d3.axisLeft(y));
    // Create a tooltip
    const tooltip = d3.select("#p06")
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
        .html("NDVI: " + d.NDVI.toFixed(2) + "<br>Mes: " + d.Month)
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
        .x(d => x(d.Month)) // Ensure the line passes through the center of the band
        .y(d => y(d.NDVI))
        .curve(d3.curveCatmullRom.alpha(0.5)); // Use curveCatmullRom for smoothing
    
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
        .attr("cy", d => y(d.NDVI))
        .attr("r", 4) // Larger radius for easier interaction
        .attr("fill", "steelblue")
        .attr("pointer-events", "all") // Ensure these circles capture mouse events
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);




}
