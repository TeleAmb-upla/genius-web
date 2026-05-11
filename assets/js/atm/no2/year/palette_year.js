import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm'; 
import { legendDomain } from '../../../legend_ranges.js';
import { physicalNo2 } from '../../../raster_quantized_decode.js';

const domain = legendDomain('no2', 'raster', 'yearly');

const baseColors = [
    '#000000', // black
    '#0000FF', // blue
    '#800080', // purple
    '#00FFFF', // cyan
    '#008000', // green
    '#FFFF00', // yellow
    '#FF0000'  // red
];
export function ToColorYear(value) {
    const v = physicalNo2(value);
    if (Number.isNaN(v)) return null;
    // Número de intervalos entre cada par de colores base
    const numIntervalsBetweenColors = 2;
    const totalColors = (baseColors.length - 1) * numIntervalsBetweenColors + 1;

    // Crear un array para almacenar los colores interpolados
    const interpolatedColors = [];

    for (let i = 0; i < baseColors.length - 1; i++) {
        // Creamos un interpolador de colores entre dos colores base
        const colorInterpolator = d3.interpolateRgb(baseColors[i], baseColors[i + 1]);
        for (let j = 0; j < numIntervalsBetweenColors; j++) {
            const t = j / numIntervalsBetweenColors;
            // Agregamos los colores interpolados al array
            interpolatedColors.push(colorInterpolator(t));
        }
    }
    // Agregar el último color de la paleta base
    interpolatedColors.push(baseColors[baseColors.length - 1]);

    // Crear la escala de colores
    const colorScale = d3.scaleLinear()
        .domain(d3.range(
            domain[0],
            domain[1] + (domain[1] - domain[0]) / (totalColors - 1),
            (domain[1] - domain[0]) / (totalColors - 1)
        ))
        .range(interpolatedColors)
        .clamp(true); // Limitar los valores fuera del dominio

    // Obtener el color correspondiente al valor dado
    return colorScale(v);
}
