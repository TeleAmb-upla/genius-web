
function valueToSTColor(value) {
    // Rango de colores para el degradado
    const red = [255, 0, 0]; // Rojo para valores negativos
    const blue = [3, 19, 255]; // Azul para valores positivos
    const white = [255, 255, 255]; // Blanco para valores cercanos a 0
    
    let color = '#000000'; // Color por defecto en caso de error

    // Función para interpolar entre dos colores
    function interpolateColor(color1, color2, factor) {
        const result = color1.map((c1, i) => Math.round(c1 + factor * (color2[i] - c1)));
        return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
    }

    // Si el valor es negativo, hacemos un degradado entre rojo y blanco
    if (value < 0) {
        const normalizedValue = Math.abs(value) / 0.6; // Normalizamos el valor entre 0 y 1
        color = interpolateColor(red, white, Math.min(normalizedValue, 1));
    }
    // Si el valor es positivo, hacemos un degradado entre blanco y azul
    else if (value > 0) {
        const normalizedValue = value / 0.6; // Normalizamos el valor entre 0 y 1
        color = interpolateColor(white, blue, Math.min(normalizedValue, 1));
    }
    // Si el valor es exactamente 0, el color será blanco
    else {
        color = 'rgb(255, 255, 255)';
    }

    return color;
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
    // Definir los rangos de valores con colores en formato hexadecimal
    const ranges = [
        { min: -0.5, max: -0.25, color: '#FF0000' },  // Rojo fuerte
        { min: -0.25, max: 0, color: '#FF6666' },     // Degradado rojo a blanco
        { min: 0, max: 0, color: '#FFFFFF' },         // Blanco puro (cero)
        { min: 0, max: 0.25, color: '#99CCFF' },      // Degradado blanco a azul claro
        { min: 0.25, max: 0.5, color: '#0000FF' }     // Azul fuerte
    ];

    // Crear los elementos de la leyenda
    const legendItems = ranges.map((range, index) => {
        const color = range.color;
        const yPosition = 25 + index * 30;
        const label = range.min === range.max 
            ? `${range.min.toFixed(2)}` // Si es 0 exacto, solo mostramos "0"
            : `${range.min.toFixed(2)} - ${range.max.toFixed(2)}`; // Rango con dos valores

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join(''); // Unir todos los elementos de la leyenda

    // Devolver el SVG completo
    return `
        <svg width="150" height="${50 + ranges.length * 30}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="14" font-family="Arial" font-weight="bold">Tendencia LST</text>
            ${legendItems}
        </svg>
    `;
}