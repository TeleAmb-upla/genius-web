import { ToColorYear } from './year/palette_year.js';
import { ToColorMonth } from './month/palette_month.js';
import * as d3 from 'https://cdn.skypack.dev/d3@7';

// Función para crear la leyenda SVG para LST anual
// Función para crear la leyenda SVG para LST anual
export function createyearLegendSVG() {
    const domain = [18, 42]; // Mínimo y máximo de temperatura
    const steps = 18; // Cantidad de colores
    const colorsBase = ["#00008B", "#00BFFF", "#32CD32", "#FFFF00", "#FFA500", "#FF4500"]; // Colores base

    // Crear una escala secuencial con 18 colores interpolados entre los colores más fuertes
    const colorScale = d3.scaleSequential()
        .domain([0, steps - 1]) // Definir el dominio
        .interpolator(d3.interpolateRgbBasis(colorsBase)); // Interpolación entre los colores base

    // Generar la paleta extendida de 18 colores
    const extendedColors = d3.range(steps).map(i => colorScale(i));

    // Altura total del SVG y tamaño de cada bloque
    const blockHeight = 15; // Altura de cada bloque de color
    const totalHeight = blockHeight * steps;

    // Crear bloques de colores con bordes para diferenciarlos
    const legendItems = extendedColors.map((color, index) => {
        const yPosition = 60 + index * blockHeight; // Posición Y para cada bloque
        return `
            <rect x="30" y="${yPosition}" width="20" height="${blockHeight}" style="fill:${color}; stroke:#000; stroke-width:0.5" />
        `;
    }).join('');

    // Crear etiquetas para los valores de cada bloque (escalados entre el dominio)
    const valueLabels = Array.from({ length: steps }, (_, i) => {
        const value = Math.round(domain[0] + i * (domain[1] - domain[0]) / (steps - 1)); // Redondear al valor entero
        const nextValue = Math.round(domain[0] + (i + 1) * (domain[1] - domain[0]) / (steps - 1)); // Valor siguiente para el rango
        const yPosition = 60 + i * blockHeight + blockHeight / 2 + 5; // Posición Y para el texto

        // Mostrar etiquetas con los rangos adecuados
        if (i === 0) {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">&lt;${value}°</text>`;
        } else if (i === steps - 1) {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">&gt;${value}°</text>`;
        } else {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">${value}° - ${nextValue}°</text>`;
        }
    }).join('');

    // Crear el SVG completo
    return `
        <svg width="165" height="${totalHeight + 80}" xmlns="http://www.w3.org/2000/svg">
            <!-- Título principal alineado a la izquierda -->
            <text x="5" y="20" font-size="14" font-family="Arial" font-weight="bold">Temperatura Superficial</text>

            <!-- Subtítulo alineado a la izquierda -->
            <text x="5" y="40" font-size="12" font-family="Arial">LST (°C) Anual</text>

            <!-- Bloques de colores -->
            ${legendItems}

            <!-- Etiquetas de valores -->
            ${valueLabels}
        </svg>
    `;
}



// Función para crear la leyenda SVG para mensual
export function createmonthLegendSVG() {
    const domain =  [8, 44]; // Mínimo y máximo
   const steps = 18; // Cantidad de colores
    const colorsBase = ["#00008B", "#00BFFF", "#32CD32", "#FFFF00", "#FFA500", "#FF4500"]; // Colores base

    // Crear una escala secuencial con 18 colores interpolados entre los colores más fuertes
    const colorScale = d3.scaleSequential()
        .domain([0, steps - 1]) // Definir el dominio
        .interpolator(d3.interpolateRgbBasis(colorsBase)); // Interpolación entre los colores base

    // Generar la paleta extendida de 18 colores
    const extendedColors = d3.range(steps).map(i => colorScale(i));

    // Altura total del SVG y tamaño de cada bloque
    const blockHeight = 15; // Altura de cada bloque de color
    const totalHeight = blockHeight * steps;

    // Crear bloques de colores con bordes para diferenciarlos
    const legendItems = extendedColors.map((color, index) => {
        const yPosition = 60 + index * blockHeight; // Posición Y para cada bloque
        return `
            <rect x="30" y="${yPosition}" width="20" height="${blockHeight}" style="fill:${color}; stroke:#000; stroke-width:0.5" />
        `;
    }).join('');

    // Crear etiquetas para los valores de cada bloque (escalados entre el dominio)
    const valueLabels = Array.from({ length: steps }, (_, i) => {
        const value = Math.round(domain[0] + i * (domain[1] - domain[0]) / (steps - 1)); // Redondear al valor entero
        const nextValue = Math.round(domain[0] + (i + 1) * (domain[1] - domain[0]) / (steps - 1)); // Valor siguiente para el rango
        const yPosition = 60 + i * blockHeight + blockHeight / 2 + 5; // Posición Y para el texto

        // Mostrar etiquetas con los rangos adecuados
        if (i === 0) {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">&lt;${value}°</text>`;
        } else if (i === steps - 1) {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">&gt;${value}°</text>`;
        } else {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">${value}° - ${nextValue}°</text>`;
        }
    }).join('');

    // Crear el SVG completo
    return `
        <svg width="165" height="${totalHeight + 80}" xmlns="http://www.w3.org/2000/svg">
            <!-- Título principal alineado a la izquierda -->
            <text x="5" y="20" font-size="14" font-family="Arial" font-weight="bold">Temperatura Superficial</text>

            <!-- Subtítulo alineado a la izquierda -->
            <text x="5" y="40" font-size="12" font-family="Arial">LST (°C) Mensual</text>

            <!-- Bloques de colores -->
            ${legendItems}

            <!-- Etiquetas de valores -->
            ${valueLabels}
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