import { ndviToColor } from './ndvi_year/ndvi_palette.js';
import { ndviToColorMonth } from './ndvi_month/ndvi_palette_month.js';

// Variable global para almacenar el elemento del título del mapa
let mapTitleDiv = null;

// Función para crear la leyenda SVG para NDVI anual
export function createyearLegendSVG() {
    const domain = [-0.3359, 0.7422]; // Mínimo y máximo
    const steps = 6; // Cantidad de valores que queremos en la leyenda
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor
    const colors = ['#ff0000', '#DF923D', '#FCD163', '#74A901', '#023B01', '#011301'];

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

    // Altura del SVG ajustada para incluir el texto adicional
    const svgHeight = 45 + steps * 25;

    // Retornar el SVG completo con el subtítulo y el texto adicional
    return `
        <svg width="150" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="14" font-family="Arial" font-weight="bold">Indicador de Áreas Verdes</text>
            <text x="0" y="30" font-size="12" font-family="Arial">NDVI Anual</text>
            ${legendItems}
          
        </svg>
    `;
}


// Función para crear la leyenda SVG para NDVI mensual
export function createmonthLegendSVG() {
    const domain = [-0.3281, 0.7969]; // Mínimo y máximo
    const steps = 6; // Cantidad de valores que queremos en la leyenda
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor
    const colors = ['#ff0000', '#DF923D', '#FCD163', '#74A901', '#023B01', '#011301'];

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

    const calculatedHeight = 40 + steps * 25; // Altura dinámica basada en la cantidad de elementos de la leyenda

    return `
        <svg width="150" height="${calculatedHeight}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="14" font-family="Arial" font-weight="bold">Indicador de Áreas Verdes</text>
            <text x="0" y="30" font-size="12" font-family="Arial">NDVI Mensual</text>
            ${legendItems}
        </svg>
    `;
    
}


// Función para añadir o actualizar el título centrado del mapa
export function addCenteredTitle(map, titleText) {
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
    mapTitleDiv.innerHTML = titleText;
}