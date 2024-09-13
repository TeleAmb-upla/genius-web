import { ToColorYear } from './year/palette_year.js';
import { ToColorMonth } from './month/palette_month.js';

// Función para crear la leyenda SVG para anual
export function createyearLegendSVG() {
    const domain = [1.6960082827681728, 7.4734310895588765]; // Mínimo y máximo
    const steps = 6; // Cantidad de valores que queremos en la leyenda (6)
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor
    
    // Generar los valores de la leyenda
    const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

    // Crear elementos de la leyenda con colores y etiquetas
    const legendItems = Values.map((value, index) => {
        const color = ToColorYear(value); // Asignar color basado en el valor
        const yPosition = 55 + index * 30; // Ajustar la posición Y para los ítems de la leyenda (debajo del subtítulo)
        const label = `${value.toFixed(2)}`; // Mostrar siempre 2 decimales

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    // Retornar el SVG completo
    return `
        <svg width="150" height="${55 + steps * 30}" xmlns="http://www.w3.org/2000/svg">
            <!-- Título principal -->
            <text x="0" y="15" font-size="14" font-family="Arial" font-weight="bold">NO² ANUAL</text>
            <!-- Subtítulo -->
            <text x="0" y="35" font-size="12" font-family="Arial" fill="#555">Valores Escalados (100.000)</text>
            <!-- Elementos de la leyenda -->
            ${legendItems}
        </svg>
    `;
}


// Función para crear la leyenda SVG para mensual
export function createmonthLegendSVG() {
    const domain =  [0.8201394139059714, 14.455718432422563]; // Mínimo y máximo
    const steps = 6; // Cantidad de valores que queremos en la leyenda (6)
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor
    
    // Generar los valores de la leyenda
    const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

     // Crear elementos de la leyenda con colores y etiquetas
     const legendItems = Values.map((value, index) => {
        const color = ToColorMonth(value); // Asignar color basado en el valor
        const yPosition = 55 + index * 30; // Ajustar la posición Y para los ítems de la leyenda (debajo del subtítulo)
        const label = `${value.toFixed(2)}`; // Mostrar siempre 2 decimales

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    // Retornar el SVG completo
    return `
        <svg width="150" height="${55 + steps * 30}" xmlns="http://www.w3.org/2000/svg">
            <!-- Título principal -->
            <text x="0" y="15" font-size="14" font-family="Arial" font-weight="bold">NO² Mensual</text>
            <!-- Subtítulo -->
            <text x="0" y="35" font-size="12" font-family="Arial" fill="#555">Valores Escalados (100.000)</text>
            <!-- Elementos de la leyenda -->
            ${legendItems}
        </svg>
    `;
}



