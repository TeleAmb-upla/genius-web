import * as d3 from 'https://cdn.skypack.dev/d3@7';

export async function g_ndvi_m_z_m() {
   const container = document.getElementById("p03");
     const width = container.offsetWidth || 550;
     const height = container.offsetHeight || 400;
     const margin = { top: 80, right: 10, bottom: 60, left: 100 };
     const innerWidth = width - margin.left - margin.right;
     const innerHeight = height - margin.top - margin.bottom;
 
     // Clear any existing SVG
     d3.select("#p09").selectAll("*").remove();
 
     // Append the svg object to the div with id "p03"
     var svg = d3.select("#p09")
         .append("svg")
         .attr("viewBox", `0 0 ${width} ${height}`)
         .attr("preserveAspectRatio", "xMidYMid meet")
         // .attr("width", width)
         // .attr("height", height)
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
         .text("NDVI Intranual Área Urbana");
 
    // titulos ejes 
    svg.append("text")
    .attr("text-anchor", "end")
    .attr("x", innerWidth / 2 + margin.left - 60)
    .attr("y", innerHeight + margin.top - 40)
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
     const data = await d3.csv("/assets/csv/NDVI_m_urban.csv");
 
     // Format the data
     data.forEach(d => {
         d.Month = +d.Month;           // Convert Month to number
         d.NDVI_median = +d.NDVI;    // Convert NDVI_median to number
     });
     // Find the minimum and maximum NDVI_median values
     const minNDVI = d3.min(data, d => d.NDVI_median);
     const maxNDVI = d3.max(data, d => d.NDVI_median);
     // Add X axis
     var x = d3.scaleLinear()
         .domain([1, 12]) // Ajustar el dominio al rango de meses
         .range([0, innerWidth]);
     svg.append("g")
         .attr("transform", "translate(0," + innerHeight + ")")
         .call(d3.axisBottom(x).ticks(12).tickFormat(d3.format("d")));
 
     // Add Y axis
     var y = d3.scaleLinear()
         .domain([minNDVI - 0.01, maxNDVI + 0.01]) // Adjust the domain to add a margin below and above
         .range([innerHeight, 0]);
     svg.append("g")
         .call(d3.axisLeft(y));
     // Create a tooltip
     const tooltip = d3.select("#p09")
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
         .html("NDVI: " + d.NDVI_median.toFixed(2) + "<br>Mes: " + d.Month)
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
         .y(d => y(d.NDVI_median))
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
         .attr("cy", d => y(d.NDVI_median))
         .attr("r", 4) // Larger radius for easier interaction
         .attr("fill", "steelblue")
         .attr("pointer-events", "all") // Ensure these circles capture mouse events
         .on("mouseover", mouseover)
         .on("mousemove", mousemove)
         .on("mouseleave", mouseleave);
 }
 
 
 