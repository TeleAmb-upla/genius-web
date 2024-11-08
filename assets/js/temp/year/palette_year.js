import * as d3 from 'https://cdn.skypack.dev/d3@7';


export function ToColorYear(value) {
        // Definir los colores de la paleta
        const domain = [18, 42]; // mínimo y máximo
    // Definir los colores de la paleta
    const range = ["#00008B", "#00BFFF", "#32CD32", "#FFFF00", "#FFA500", "#FF4500"];
    
    // Crear la escala de colores con d3
    const colorScale = d3.scaleLinear()
        .domain(d3.range(domain[0], domain[1], (domain[1] - domain[0]) / (range.length - 1)).concat(domain[1]))
        .range(range)
        .interpolate(d3.interpolateRgb);  // Interpolación RGB para gradiente suave
    
    // Si el valor es menor o mayor al dominio, devolver los colores extremos
    if (value < domain[0]) {
        return range[0]; // Si es menor que el mínimo, devolver el primer color
    } 
    if (value > domain[1]) {
        return range[range.length - 1]; // Si es mayor que el máximo, devolver el último color
    }

    // Devolver el color interpolado basado en el valor
    return colorScale(value);
}
