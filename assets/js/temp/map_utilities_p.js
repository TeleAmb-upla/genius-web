import { ToColorYear } from './year/palette_year.js';
import { ToColorMonth } from './month/palette_month.js';

// Función para crear la leyenda SVG para LST anual
// Función para crear la leyenda SVG para LST anual
export function createyearLegendSVG() {
    const Values = [[16, 23], [23, 28], [28, 33], [33, 38], [38, 42]];  // Define los rangos como arrays

    const legendItems = Values.map((range, index) => {
        const LST_median = (range[0] + range[1]) / 2;  // Calcula el valor promedio del rango para obtener el color
        const color = ToColorYear(LST_median);
        const yPosition = 25 + index * 30;
        const label = `${range[0]}°C - ${range[1]}°C`;  // Muestra el rango con el símbolo de grados Celsius

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    return `
        <svg width="100" height="220" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial">LST ANUAL</text>
            ${legendItems}
        </svg>
    `;
}


// Función para crear la leyenda SVG para LST mensual
export function createmonthLegendSVG() {
    const Values = [[7, 15], [15, 22], [22, 31], [31, 39], [39, 44]];  // Define los rangos como arrays
    const legendItems = Values.map((range, index) => {
        const LST_median = (range[0] + range[1]) / 2;  // Calcula el valor promedio del rango para obtener el color
        const color = ToColorYear(LST_median);
        const yPosition = 25 + index * 30;
        const label = `${range[0]}°C - ${range[1]}°C`;  // Muestra el rango con el símbolo de grados Celsius

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    return `
        <svg width="100" height="220" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial">LST ANUAL</text>
            ${legendItems}
        </svg>
    `;
}


