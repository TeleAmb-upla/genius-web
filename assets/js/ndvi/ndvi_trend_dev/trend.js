import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { fetchGeoTiffTryPaths } from '../../raster_fetch.js';
import { candidatePathsNdviTrend } from '../ndvi_raster_paths.js';
function valueToSTColor(value) {

const domain = [-0.107, 0.107]; // mínimo y máximo
// Paleta de colores invertida que representa los diferentes valores de NDVI
const range = [
    "#ff0000", // Rojo intenso para los valores negativos bajos
    "#ff3d66", // Rojo medio para valores negativos moderados
    "#ff75ad", // Rojo suave para valores negativos más cercanos a 0
    "#ffffff", // Blanco para el valor 0
    "#75aaff", // Azul claro para valores positivos bajos
    "#4d66ff", // Azul medio para valores positivos moderados
    "#0313ff"  // Azul intenso para valores positivos altos
]; // Invertir el orden para que el rojo sea el primer color

// Calcular el paso entre cada color en función del dominio
const step = (domain[1] - domain[0]) / (range.length - 1);

// Asignar los colores basado en el valor
if (value < domain[0]) {
    return range[0]; // Si es menor que el mínimo, devolver el primer color
} 
if (value > domain[1]) {
    return range[range.length - 1]; // Si es mayor que el máximo, devolver el último color
}

// Encontrar el color adecuado dentro del rango
const index = Math.floor((value - domain[0]) / step);
return range[index];
}


export async function map_trend(map) {
    const arrayBuffer = await fetchGeoTiffTryPaths(candidatePathsNdviTrend());
    if (!arrayBuffer) {
        return null;
    }

    // Parsear el georaster
    const georaster = await parseGeoraster(arrayBuffer);

    // Crear la capa de GeoRaster con la nueva lógica de colores
    const Layer = new GeoRasterLayer({
        georaster: georaster,
        pixelValuesToColorFn: values => {
            const Value = values[0];
            if (isNaN(Value)) {
                return null; // Retornar null si el valor es NaN
            }
            return valueToSTColor(Value); // Aplicar la función de colores según el valor
        },
        resolution: 384 // Resolución de la capa

    });

    // Retornar tanto la capa como el georaster
    return { layer: Layer, georaster: georaster };
}

export function createSTLegendSVG() {
    const labels = [
        { text: '> 0.10',  color: '#0313ff' },
        { text: '0.075',   color: '#4d66ff' },
        { text: '0.05',    color: '#75aaff' },
        { text: '0.025',   color: '#b0d4ff' },
        { text: '0',       color: '#ffffff' },
        { text: '-0.025',  color: '#ffb0c4' },
        { text: '-0.05',   color: '#ff75ad' },
        { text: '-0.075',  color: '#ff3d66' },
        { text: '< -0.10', color: '#ff0000' },
    ];

    const blockHeight = 20;
    const totalHeight = blockHeight * labels.length;

    const legendItems = labels.map(({ color }, i) => {
        const y = 60 + i * blockHeight;
        return `<rect x="30" y="${y}" width="20" height="${blockHeight}" style="fill:${color}; stroke:#000; stroke-width:0.5"/>`;
    }).join('');

    const valueLabels = labels.map(({ text }, i) => {
        const y = 60 + i * blockHeight + blockHeight / 2 + 4;
        const weight = text === '0' ? ' font-weight="bold"' : '';
        return `<text x="60" y="${y}" font-size="10" font-family="Arial"${weight}>${text}</text>`;
    }).join('');

    return `
        <svg class="map-legend-svg" width="165" height="${totalHeight + 80}" xmlns="http://www.w3.org/2000/svg">
            <text x="5" y="20" font-size="14" font-family="Arial" font-weight="bold">Tendencia NDVI</text>
            <text x="5" y="40" font-size="12" font-family="Arial">2017 - 2025</text>
            ${legendItems}
            ${valueLabels}
        </svg>
    `;
}

