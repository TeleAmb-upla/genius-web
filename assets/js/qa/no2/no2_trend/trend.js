import * as d3 from 'https://cdn.skypack.dev/d3@7';


function valueToSTColor(value) {    
    const domain = [-0.9297, 0.4297]; // mínimo y máximo

    // Paleta de colores que representa los diferentes valores de la tendencia
    const range = [
        "#ff0000", // Rojo intenso para los valores negativos bajos
        "#ff3d66", // Rojo medio para valores negativos moderados
        "#ff75ad", // Rojo suave para valores negativos más cercanos a 0
        "transparent", // Transparente para valores entre -1 y 1
        "#75aaff", // Azul claro para valores positivos bajos
        "#4d66ff", // Azul medio para valores positivos moderados
        "#0313ff"  // Azul intenso para valores positivos altos
    ].reverse();

    // Calcular el paso entre cada color en función del dominio
    const step = (domain[1] - domain[0]) / (range.length - 1);

    // Asignar los colores basado en el valor

    /*// Si el valor está entre -1 y 1, devolver transparente
    if (value >= -1 && value <= 1) {
        return "transparent"; // Transparente para los valores entre -1 y 1, incluyendo 0
    }
*/
    // Si el valor es menor que el mínimo, devolver el primer color (rojo intenso)
    if (value < domain[0]) {
        return range[0];
    } 
    
    // Si el valor es mayor que el máximo, devolver el último color (azul intenso)
    if (value > domain[1]) {
        return range[range.length - 1];
    }

    // Encontrar el color adecuado dentro del rango
    const index = Math.floor((value - domain[0]) / step);
    
    return range[index];
}


export async function map_trend(map) {
    try {
        // Leer el archivo  
        const response = await fetch('/assets/vec/raster/no2_pixel/NO2_Trend/NO2_Yearly_Trend.tif');
        const arrayBuffer = await response.arrayBuffer();

        // Parsear el georaster
        const georaster = await parseGeoraster(arrayBuffer);

        // Crear la capa de GeoRaster
        const Layer = new GeoRasterLayer({
            georaster: georaster,
            pixelValuesToColorFn: values => {
                const Value = values[0];
                if (isNaN(Value)) {
                    return null; // Retornar null si el valor es NaN
                }
                return valueToSTColor(Value);
            },
            resolution: 1080
        });

        // Retornar un objeto con la capa y el georaster
        return {
            layer: Layer,
            georaster: georaster
        };
    } catch (error) {
        console.error('Error al cargar el georaster de tendencia:', error);
        return null;
    }
}

export function createSTLegendSVG() {
    const domain = [-7, 7]; // Mínimo y máximo para tendencia NO²
    const steps = 9; // Cantidad de bloques: 4 rojos, 1 blanco, 4 azules
    const colorsBase = ["#ff0000", "#ff3d66", "#ff75ad", "#ffffff", "#75aaff", "#4d66ff", "#0313ff"].reverse(); // 4 colores para rojos y azules, blanco en el centro

    // Crear una escala secuencial con los colores interpolados
    const colorScale = d3.scaleSequential()
        .domain([0, steps - 1]) // Definir el dominio
        .interpolator(d3.interpolateRgbBasis(colorsBase)); // Interpolación entre los colores base

    // Generar la paleta extendida de colores
    const extendedColors = d3.range(steps).map(i => colorScale(i));

    // Altura total del SVG y tamaño de cada bloque
    const blockHeight = 20; // Altura de cada bloque de color
    const totalHeight = blockHeight * steps; // La altura total es basada en los 9 bloques

    // Crear bloques de colores con bordes para diferenciarlos
    const legendItems = extendedColors.map((color, index) => {
        let yPosition = 60 + index * blockHeight;

        return `
            <rect x="30" y="${yPosition}" width="20" height="${blockHeight}" style="fill:${color}; stroke:#000; stroke-width:0.5" />
        `;
    }).join('');

    // Crear etiquetas para los valores de cada bloque (escalados entre el dominio)
    const valueLabels = Array.from({ length: steps }, (_, i) => {
        const value = (domain[0] + i * (domain[1] - domain[0]) / (steps - 1)).toFixed(2); // Redondear el valor
        const nextValue = (domain[0] + (i + 1) * (domain[1] - domain[0]) / (steps - 1)).toFixed(2); // Valor siguiente para el rango
        const yPosition = 60 + i * blockHeight + blockHeight / 2 + 5;

        // Mostrar etiquetas con los rangos adecuados
        if (i === 0) {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">&lt;${value}</text>`;
        } else if (i === steps - 1) {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">&gt;7.00</text>`; // Último bloque para >7.00
        } else if (i === Math.floor(steps / 2)) {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">0</text>`;
        } else {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">${value} - ${nextValue}</text>`;
        }
    }).join('');

    // Crear el SVG completo
    return `
        <svg width="190" height="${totalHeight + 80}" xmlns="http://www.w3.org/2000/svg">
            <!-- Título principal alineado a la izquierda -->
            <text x="0" y="20" font-size="12" font-family="Arial" font-weight="bold">Dióxido de Nitrógeno Tendencia</text>

            <!-- Subtítulo alineado a la izquierda -->
            <text x="0" y="40" font-size="10" font-family="Arial">NO<tspan baseline-shift="sub">2</tspan>(µmol/m²) 2019-2023</text>

            <!-- Bloques de colores -->
            ${legendItems}

            <!-- Etiquetas de valores -->
            ${valueLabels}
        </svg>
    `;
}