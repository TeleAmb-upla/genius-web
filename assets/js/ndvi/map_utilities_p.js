import { ndviToColor } from './ndvi_year/ndvi_palette.js';
import { ndviToColorMonth } from './ndvi_month/ndvi_palette_month.js';

// Variable global para almacenar el elemento del título del mapa
let mapTitleDiv = null;

// Función para crear la leyenda SVG para NDVI anual
export function createyearLegendSVG() {
    const ndviValues = [0.7422, 0.5, 0.25, 0, -0.1, -0.2, -0.3359];

    const legendItems = ndviValues.map((ndvi, index) => {
        const color = ndviToColor(ndvi);
        const yPosition = 25 + index * 30;
        const label = `${Math.round(ndvi * 100) / 100}`;

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    return `
        <svg width="100" height="220" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial">NDVI ANUAL</text>
            ${legendItems}
        </svg>
    `;
}

// Función para crear la leyenda SVG para NDVI mensual
export function createmonthLegendSVG() {
    const ndviValues = [0.7969, 0.6, 0.4, 0.2, 0, -0.1, -0.3281];

    const legendItems = ndviValues.map((ndvi, index) => {
        const color = ndviToColorMonth(ndvi);
        const yPosition = 25 + index * 30;
        const label = `${Math.round(ndvi * 100) / 100}`;

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    return `
        <svg width="100" height="220" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial">NDVI MENSUAL</text>
            ${legendItems}
        </svg>
    `;
}

// Función para agregar o actualizar el título centrado al mapa
export function addCenteredTitle(map) {
    if (!mapTitleDiv) {
        // Crear el elemento del título si no existe
        mapTitleDiv = document.createElement('div');
        mapTitleDiv.id = 'map-title';
        mapTitleDiv.style.position = 'absolute';
        mapTitleDiv.style.top = '10px';
        mapTitleDiv.style.left = '50%';
        mapTitleDiv.style.transform = 'translate(-50%, 0)';
        mapTitleDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        mapTitleDiv.style.padding = '10px';
        mapTitleDiv.style.borderRadius = '8px';
        mapTitleDiv.style.zIndex = '1000';
        mapTitleDiv.style.pointerEvents = 'none';
        mapTitleDiv.style.fontFamily = 'Arial';
        mapTitleDiv.style.fontSize = '14px';
        mapTitleDiv.style.fontWeight = 'bold';
        map.getContainer().appendChild(mapTitleDiv);
    }

    // Actualiza el contenido del título
    mapTitleDiv.innerHTML = `NDVI Pixel Distrito Urbano`;
}
