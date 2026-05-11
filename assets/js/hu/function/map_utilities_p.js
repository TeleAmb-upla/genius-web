import { mountGeniusLeafletMapTitle } from '../../map_data_catalog.js';

// Función para agregar o actualizar el título centrado al mapa
export function addCenteredTitle(map, titleText, options = {}) {
    const text = titleText !== undefined ? titleText : 'Huella Urbana anual';
    mountGeniusLeafletMapTitle(map, text, options);
}

// Función para crear la leyenda SVG para los años
export function createLegendSVG() {
    const years = [2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018];
    
    const colorMapping = {
        2026: '#999999',
        2025: '#f781bf',
        2024: '#a65628',
        2018: '#ffff33', 
        2019: '#ff7f00',  
        2020: '#984ea3', 
        2021: '#4daf4a',
        2022: '#377eb8',
        2023: '#e41a1c'
    };

    const legendItems = years.map((year, index) => {
        const color = colorMapping[year];
        const yPosition = 25 + index * 30;  // Espaciado de 30px entre cada entrada de la leyenda

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${year}</text>
        `;
    }).join('');

    return `
        <svg class="map-legend-svg" width="110" height="290" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial">Huella Urbana</text>
            ${legendItems}
        </svg>
    `;
}
