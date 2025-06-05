import * as d3 from 'https://cdn.skypack.dev/d3@7';
function valueToSTColor(value) {
    const domain = [0, 0.44]; // mínimo y máximo
    // Paleta de colores invertida que representa los diferentes valores de NDVI
    const range = [
        "#FFF2ED", "#FFB6B2", "#FF7977", "#FF3D3B", "#FF0000"
    ]
    
    // Calcular el paso entre cada color en función del dominio
    const step = (domain[1] - domain[0]) / (range.length - 1);
    
    // Asignar los colores basado en el valor
    if (value < domain[0]) {
        return range[0]; // Si es menor que el mínimo, devolver el primer color
    } 
    if (value > domain[1]) {
        return range[range.length - 1]; // Si es mayor que el máximo, devolver el último color
    }
    
    // Encontrar el color adecuado dentro del rango
    const index = Math.floor((value - domain[0]) / step);
    return range[index];
    }

export async function map_trend(map) {
    try {
        // Leer el archivo  
        const response = await fetch('/assets/vec/raster/lst_pixel/lst_Trend/LST_Yearly_Trend.tif');
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
    const domain = [0, 0.44]; // Mínimo y máximo
    const steps = 6; // 3 tonos de rojo y 2 tonos de azul
    const colorsBase = ["#FFF2ED", "#FFB6B2", "#FF7977", "#FF3D3B", "#FF0000"]; // Tres rojos de intensidad decreciente y dos azules

    // Crear una escala cuantizada que asigna rangos de dominio a colores específicos
    const colorScale = d3.scaleQuantize()
        .domain(domain) // [0, 0.44]
        .range(colorsBase); // Array de 5 colores
    
    // Generar la paleta extendida de colores mapeando cada paso al valor correspondiente en el dominio
    const extendedColors = d3.range(steps).map(i => {
        const value = domain[0] + i * (domain[1] - domain[0]) / (steps - 1);
        return colorScale(value);
    });
    
    // Altura total del SVG y tamaño de cada bloque
    const blockHeight = 20; // Altura de cada bloque de color
    const totalHeight = blockHeight * steps; // La altura total es basada en los 5 bloques
    
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
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">&gt;${domain[1].toFixed(2)}</text>`; // Último bloque para >0.44
        } else {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">${value} - ${nextValue}</text>`;
        }
    }).join('');
    
    // Crear el SVG completo
    return `
        <svg width="165" height="${totalHeight + 80}" xmlns="http://www.w3.org/2000/svg">
            <!-- Título principal alineado a la izquierda -->
            <text x="5" y="20" font-size="12" font-family="Arial" font-weight="bold">Tendencia LST(°C)</text>
    
            <!-- Subtítulo alineado a la izquierda -->
            <text x="5" y="40" font-size="10" font-family="Arial">1995 - 2024</text>
    
            <!-- Bloques de colores -->
            ${legendItems}
    
            <!-- Etiquetas de valores -->
            ${valueLabels}
        </svg>
    `;
}




