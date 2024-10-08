function valueToSTColor(value) {
    const domain = [
        -4.9, -3, -2, -1, 
         0, 
          1,  2,  3.3
    ];

    const range = [
        "#FF0000", "#fb3629", "#FF1E1F", "#FE393A", // Rojos para valores negativos
        "#FFFFFF", // Blanco para valor 0
        "#A8ABFD", "#7178FE", "#0313FF", "#0000FF" // Azules para valores positivos
    ];

    for (let i = 0; i < domain.length; i++) {
        if (value <= domain[i]) {
            return range[i];
        }
    }
    return range[range.length - 1];
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
    const Values = [   -4, -2, 0, 2, 4];

    const legendItems = Values.map((trend, index) => {
        const color = valueToSTColor(trend);
        const yPosition = 25 + index * 30;
        const label = `${Math.round(trend * 100) / 100}`;

        return `
            <rect x="0" y="${yPosition}" width="15" height="15" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    return `
        <svg width="100" height="220" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial">Tendencia</text>
            ${legendItems}
        </svg>
    `;
}

