import { ndviToColor } from './ndvi_year/ndvi_palette.js';
import { ndviToColorMonth } from './ndvi_month/ndvi_palette_month.js';
import { legendDomain } from '../legend_ranges.js';
import { mountGeniusLeafletMapTitle } from '../map_data_catalog.js';


// Función para crear la leyenda SVG para NDVI anual
export function createyearLegendSVG(isMobile = false) {
    const domain = legendDomain('ndvi', 'raster', 'yearly');
    const steps = 6;
    const stepValue = (domain[1] - domain[0]) / (steps - 1);
    const colors = ['#ff0000', '#DF923D', '#FCD163', '#74A901', '#2E5D2D', '#194D18'];
    const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

    // Parámetros para móvil o desktop (más compacto en móvil, pero más ancho para no cortar texto)
    const width = isMobile ? 132 : 172;
    const fontSizeTitle = isMobile ? 8 : 15;
    const fontSizeSubtitle = isMobile ? 7 : 13;
    const fontSizeLabel = isMobile ? 7 : 13;
    const rectSize = isMobile ? 8 : 20;
    const yStart = isMobile ? 18 : 45;
    const yStep = isMobile ? 11 : 30;
    const svgHeight = yStart + steps * (isMobile ? 9 : 25);

    // Crear elementos de la leyenda con colores y rangos
    const legendItems = Values.map((value, index) => {
        if (index === Values.length - 1) return '';
        const nextValue = Values[index + 1];
        const color = colors[index];
        const yPosition = yStart + index * yStep;
        const label = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`;
        return `
            <rect x="0" y="${yPosition}" width="${rectSize}" height="${rectSize}" style="fill:${color}" />
            <text x="${rectSize + 3}" y="${yPosition + rectSize - 1}" font-size="${fontSizeLabel}" font-family="Arial">${label}</text>
        `;
    }).join('');

    // Retornar el SVG completo con el subtítulo y el texto adicional
    return `
        <svg class="map-legend-svg" width="${width}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="${fontSizeTitle + 2}" font-size="${fontSizeTitle}" font-family="Arial" font-weight="bold">Indicador de vegetación</text>
            <text x="0" y="${fontSizeTitle + fontSizeSubtitle + 5}" font-size="${fontSizeSubtitle}" font-family="Arial">Anual</text>
            ${legendItems}
        </svg>
    `;
}


// Función para crear la leyenda SVG para NDVI mensual
export function createmonthLegendSVG(isMobile = false) {
    const domain = legendDomain('ndvi', 'raster', 'monthly');
    const steps = 6;
    const stepValue = (domain[1] - domain[0]) / (steps - 1);
    const colors = ['#ff0000', '#DF923D', '#FCD163', '#74A901', '#2E5D2D', '#194D18'];
    const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

    // Parámetros para móvil o desktop (más compacto en móvil, pero más ancho para no cortar texto)
    const width = isMobile ? 130 : 170;
    const fontSizeTitle = isMobile ? 8 : 15;
    const fontSizeSubtitle = isMobile ? 7 : 13;
    const fontSizeLabel = isMobile ? 7 : 13;
    const rectSize = isMobile ? 8 : 20;
    const yStart = isMobile ? 18 : 45;
    const yStep = isMobile ? 11 : 30;
    const svgHeight = yStart + steps * (isMobile ? 9 : 25);

    const legendItems = Values.map((value, index) => {
        if (index === Values.length - 1) return '';
        const nextValue = Values[index + 1];
        const color = colors[index];
        const yPosition = yStart + index * yStep;
        const label = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`;
        return `
            <rect x="0" y="${yPosition}" width="${rectSize}" height="${rectSize}" style="fill:${color}" />
            <text x="${rectSize + 3}" y="${yPosition + rectSize - 1}" font-size="${fontSizeLabel}" font-family="Arial">${label}</text>
        `;
    }).join('');

    return `
        <svg class="map-legend-svg" width="${width}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="${fontSizeTitle + 2}" font-size="${fontSizeTitle}" font-family="Arial" font-weight="bold">Indicador de vegetación</text>
            <text x="0" y="${fontSizeTitle + fontSizeSubtitle + 5}" font-size="${fontSizeSubtitle}" font-family="Arial">Mensual</text>
            ${legendItems}
        </svg>
    `;
}

// Función para añadir o actualizar el título centrado del mapa
export function addCenteredTitle(map, titleText, options = {}) {
    mountGeniusLeafletMapTitle(map, titleText, options);
}