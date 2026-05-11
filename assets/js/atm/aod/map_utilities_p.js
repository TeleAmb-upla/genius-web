import { ToColorYear } from './year/palette_year.js';
import { ToColorMonth } from './month/palette_month.js';
import { legendDomain } from '../../legend_ranges.js';
import { mountGeniusLeafletMapTitle } from '../../map_data_catalog.js';

// Función para crear la leyenda SVG para Profundidad Óptica de Aerosoles
export function createyearLegendSVG() {
    const domain = legendDomain('aod', 'raster', 'yearly');
    const steps = 7; // Cantidad de valores que queremos en la leyenda (6)
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor

    // Colores fijos para la leyenda
    const colors = ["#00008B", "#4B0082", "#8A2BE2", "#DA70D6", "#FF69B4", "#FFC0CB"].reverse();

    // Generar los valores de la leyenda
    const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

    // Crear elementos de la leyenda con colores y rangos
    const legendItems = Values.map((value, index) => {
        if (index === Values.length - 1) return ''; // No mostrar para el último valor

        const nextValue = Values[index + 1]; // Próximo valor para calcular el rango
        const color = colors[index]; // Asignar color basado en el índice
        const yPosition = 45 + index * 30; // Posición Y para cada ítem de la leyenda

        // Mostrar el rango entre los valores
        const label = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`;

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    // Altura del SVG ajustada para incluir el texto adicional
    const svgHeight = 45 + steps * 30 + 30;

    // Retornar el SVG completo
    return `
        <svg class="map-legend-svg" width="200" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial" font-weight="bold">Profundidad óptica de aerosoles</text>
            <text x="0" y="30" font-size="12" font-family="Arial">Anual</text>
            ${legendItems}

        </svg>
    `;
}



// Función para crear la leyenda SVG para Profundidad Óptica de Aerosoles
export function createmonthLegendSVG() {
    const domain = legendDomain('aod', 'raster', 'monthly');
    const steps = 7; // Cantidad de valores que queremos en la leyenda (6)
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor
    
      // Colores fijos para la leyenda
      const colors = ["#00008B", "#4B0082", "#8A2BE2", "#DA70D6", "#FF69B4", "#FFC0CB"].reverse();
    // Generar los valores de la leyenda
    const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

    // Crear elementos de la leyenda con colores y rangos
    const legendItems = Values.map((value, index) => {
        if (index === Values.length - 1) return ''; // No mostrar para el último valor

        const nextValue = Values[index + 1]; // Próximo valor para calcular el rango
        const color = colors[index]; // Asignar color basado en el valor
        const yPosition = 45 + index * 30; // Posición Y para cada ítem de la leyenda

        // Mostrar el rango entre los valores
        const label = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`;

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');
    const svgHeight = 45 + steps * 30 + 30;
    // Retornar el SVG completo
    return `
        <svg class="map-legend-svg" width="200" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial" font-weight="bold">Profundidad óptica de aerosoles</text>
              <text x="0" y="30" font-size="12" font-family="Arial">Mensual</text>
            ${legendItems}
    
        </svg>
    `;
}


// Función para añadir o actualizar el título centrado del mapa
export function addCenteredTitle(map, titleText, options = {}) {
    mountGeniusLeafletMapTitle(map, titleText, options);
}