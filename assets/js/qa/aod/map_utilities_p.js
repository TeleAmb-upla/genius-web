import { ToColorYear } from './year/palette_year.js';
import { ToColorMonth } from './month/palette_month.js';

// Función para crear la leyenda SVG para AOD anual
export function createyearLegendSVG() {
    const domain = [87.8, 112.6]; // Mínimo y máximo
    const steps = 6; // Cantidad de valores que queremos en la leyenda (6)
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor
    
    // Generar los valores de la leyenda
    const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

    // Crear elementos de la leyenda con colores y rangos
    const legendItems = Values.map((value, index) => {
        if (index === Values.length - 1) return ''; // No mostrar para el último valor

        const nextValue = Values[index + 1]; // Próximo valor para calcular el rango
        const color = ToColorYear(value); // Asignar color basado en el valor
        const yPosition = 25 + index * 30; // Posición Y para cada ítem de la leyenda

        // Mostrar el rango entre los valores
        const label = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`;

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    // Retornar el SVG completo
    return `
        <svg width="150" height="${25 + steps * 30}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial">AOD ANUAL</text>
            ${legendItems}
        </svg>
    `;
}



// Función para crear la leyenda SVG para AOD mensual
export function createmonthLegendSVG() {
    const domain = [73.3, 131.9]; // Mínimo y máximo
    const steps = 6; // Cantidad de valores que queremos en la leyenda (6)
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor
    
    // Generar los valores de la leyenda
    const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

    // Crear elementos de la leyenda con colores y rangos
    const legendItems = Values.map((value, index) => {
        if (index === Values.length - 1) return ''; // No mostrar para el último valor

        const nextValue = Values[index + 1]; // Próximo valor para calcular el rango
        const color = ToColorMonth(value); // Asignar color basado en el valor
        const yPosition = 25 + index * 30; // Posición Y para cada ítem de la leyenda

        // Mostrar el rango entre los valores
        const label = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`;

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    // Retornar el SVG completo
    return `
        <svg width="150" height="${25 + steps * 30}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial">AOD MENSUAL</text>
            ${legendItems}
        </svg>
    `;
}
