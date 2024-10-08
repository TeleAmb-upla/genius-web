function valueToDevColor(value) {
  
const domain = [0, 0.22]; // mínimo y máximo
// Paleta de colores invertida que representa los diferentes valores de NDVI
const range =   ["#008000", "#a19b00", "#da9b00", "#ff8b00", "#ff5f00", "#ff0000"];
   

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

    export async function map_stdev(map) {
        try {
            // Leer el archivo  
            const response = await fetch('/assets/vec/raster/NDVI_pixel/NDVI_StdDev/NDVI_Monthly_StdDev_2022-2024.tif');
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
                    return valueToDevColor(Value);
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
export function createDevLegendSVG() {
    const domain =  [0, 0.22]; // Mínimo y máximo
    const steps =7; // Cantidad de valores que queremos en la leyenda
    const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular el paso entre cada valor
    const colors =  ["#008000", "#a19b00", "#da9b00", "#ff8b00", "#ff5f00", "#ff0000"];

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
        <svg width="180" height="${calculatedHeight}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="14" font-family="Arial" font-weight="bold">Indicador de Desmalezado</text>
            <text x="0" y="30" font-size="12" font-family="Arial">Desviación Estándar</text>
            ${legendItems}
        </svg>
    `;
    
}

