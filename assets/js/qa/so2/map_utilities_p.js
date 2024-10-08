import { ToColorYear } from './year/palette_year.js';
import { ToColorMonth } from './month/palette_month.js';
// Función para crear la leyenda SVG para anual
export function createyearLegendSVG() {
    const domain = [440.4461960739061, 512.531912529971]; // Mínimo y máximo
    const steps = 7; // Cantidad de valores que queremos en la leyenda (6)
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor

    const colors =  ["#C3E934", "#335B01", "#FFE733", "#FFA500", "#FF4500", "#8B0000"];

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
    }).join(''); // Esto creará el HTML de los elementos de la leyenda

        // Altura del SVG ajustada para incluir el texto adicional
        const svgHeight = 45 + steps * 25;
    // Retornar el SVG completo
    return `
        <svg width="180" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
            <!-- Título principal --> 
            <text x="0" y="15" font-size="14" font-family="Arial" font-weight="bold">Dióxido de Azufre Anual</text>
            <!-- Subtítulo -->
            <text x="0" y="35" font-size="12" font-family="Arial" fill="#555">SO² (µmol/m²)</text>
            <!-- Elementos de la leyenda -->
            ${legendItems}
        </svg>
    `;
}


// Función para crear la leyenda SVG para mensual
export function createmonthLegendSVG() {
    const domain = [158.7144074633454, 1993.3201294191167]; // Mínimo y máximo
    const steps = 7; // Cantidad de valores que queremos en la leyenda (6)
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor
    
    const colors =  ["#C3E934", "#335B01", "#FFE733", "#FFA500", "#FF4500", "#8B0000"];

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
    }).join(''); // Esto creará el HTML de los elementos de la leyenda

        // Altura del SVG ajustada para incluir el texto adicional
        const svgHeight = 45 + steps * 25;
    // Retornar el SVG completo
    return `
        <svg width="180" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
            <!-- Título principal -->
            <text x="0" y="15" font-size="14" font-family="Arial" font-weight="bold">Dióxido de Azufre Mensual</text>
            <!-- Subtítulo -->
            <text x="0" y="35" font-size="12" font-family="Arial" fill="#555">SO² (µmol/m²)</text>
            <!-- Elementos de la leyenda -->
            ${legendItems}
        </svg>
    `;
}



export function addCenteredTitle(map) {
    // Declarar mapTitleDiv y tratar de obtener el elemento existente
    let mapTitleDiv = document.getElementById('map-title');

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
    mapTitleDiv.innerHTML = `SO² Pixel Distrito Urbano`;
}