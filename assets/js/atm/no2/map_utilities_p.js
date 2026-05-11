import { ToColorYear } from './year/palette_year.js';
import { ToColorMonth } from './month/palette_month.js';
import { legendDomain } from '../../legend_ranges.js';
import { mountGeniusLeafletMapTitle } from '../../map_data_catalog.js';

// Función para crear la leyenda SVG para anual
export function createyearLegendSVG() {
    const domain = legendDomain('no2', 'raster', 'yearly');
    const steps = 8; // Cantidad de valores que queremos en la leyenda (6)
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor
    
    const colors = [
        '#333333', // black
        '#0000FF', // blue
        '#800080', // purple
        '#00FFFF', // cyan
        '#008000', // green
        '#FFFF00', // yellow
        '#FF0000'  // red
    ];

    // Generar los valores de la leyenda
    const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

    // Crear elementos de la leyenda con colores y rangos
    const legendItems = Values.map((value, index) => {
        if (index === Values.length - 1) return ''; // No mostrar para el último valor

        const nextValue = Values[index + 1];
        const color = colors[index]; // Asignar color basado en el valor
        const yPosition = 45 + index * 30; // Ajustar la posición Y para incluir el subtítulo

        const label = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`;
        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    // Retornar el SVG completo
    return `
        <svg class="map-legend-svg" width="300" height="${55 + steps * 30}" xmlns="http://www.w3.org/2000/svg">
            <!-- Título principal -->
            <text x="5" y="15" font-size="14" font-family="Arial" font-weight="bold">Dióxido de nitrógeno — Anual</text>
            <!-- Subtítulo con subíndice -->
            <text x="5" y="35" font-size="12" font-family="Arial" fill="#555">
                NO<tspan baseline-shift="sub">2</tspan> (µmol/m²)
            </text>
            <!-- Elementos de la leyenda -->
            ${legendItems}
        </svg>
    `;
}



// Función para crear la leyenda SVG para mensual
export function createmonthLegendSVG() {
    const domain = legendDomain('no2', 'raster', 'monthly');
    const steps = 8; // Cantidad de valores que queremos en la leyenda (6)
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor
    // Colores fijos para la leyenda
    const colors = [ '#333333', // black
        '#0000FF', // blue
        '#800080', // purple
        '#00FFFF', // cyan
        '#008000', // green
        '#FFFF00', // yellow
        '#FF0000'  // red
      ];


    // Generar los valores de la leyenda
   
    // Generar los valores de la leyenda
    const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);
    // Crear elementos de la leyenda con colores y rangos
    const legendItems = Values.map((value, index) => {
        if (index === Values.length - 1) return ''; // No mostrar para el último valor

        const nextValue = Values[index + 1];
        const color = colors[index]; // Asignar color basado en el valor
        const yPosition = 45 + index * 30; // Ajustar la posición Y para incluir el subtítulo

        const label = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`;
        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    // Retornar el SVG completo  
    return `
        <svg class="map-legend-svg" width="202" height="${55 + steps * 30}" xmlns="http://www.w3.org/2000/svg">
            <!-- Título principal -->
            <text x="0" y="15" font-size="14" font-family="Arial" font-weight="bold">Dióxido de nitrógeno — Mensual</text>
            <!-- Subtítulo -->
            <text x="0" y="35" font-size="12" font-family="Arial" fill="#555">NO<tspan baseline-shift="sub">2</tspan> (µmol/m²)</text>
            <!-- Elementos de la leyenda -->
            ${legendItems}
        </svg>
    `;
}



export function addCenteredTitle(map, titleText, options = {}) {
    mountGeniusLeafletMapTitle(map, titleText, options);
}