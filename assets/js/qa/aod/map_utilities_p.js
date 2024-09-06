import { ToColorYear } from './year/palette_year.js';
import { ToColorMonth } from './month/palette_month.js';

// Función para crear la leyenda SVG para anual
export function createyearLegendSVG() {
    const Values = [0.7422, 0.5, 0.25, 0, -0.1, -0.2, -0.3359];

    const legendItems = Values.map((AOD_Median, index) => {
        const color = ToColorYear(AOD_Median);
        const yPosition = 25 + index * 30;
        const label = `${Math.round(AOD_Median * 100) / 100}`;

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    return `
        <svg width="100" height="220" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial">AOD ANUAL</text>
            ${legendItems}
        </svg>
    `;
}

// Función para crear la leyenda SVG para mensual
export function createmonthLegendSVG() {
    const Values = [0.7969, 0.6, 0.4, 0.2, 0, -0.1, -0.3281];

    const legendItems = Values.map((AOD_Median, index) => {
        const color = ToColorMonth(AOD_Median);
        const yPosition = 25 + index * 30;
        const label = `${Math.round(AOD_Median * 100) / 100}`;

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    return `
        <svg width="100" height="220" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial">AOD MENSUAL</text>
            ${legendItems}
        </svg>
    `;
}

