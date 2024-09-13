function valueToDevColor(value) {
    // Definir los colores de la paleta
    const domain = [
            -0.1,-0.05, 0, 0.05, 0.1, 
    ];
    const range = [
        "#008000", "#4d8a00", "#799300", "#a19b00", "#c8a100", "#da9b00", "#ec9400", "#ff8b00", "#ff7600", "#ff5f00", "#ff4100", "#ff0000"
    ];

    for (let i = 0; i < domain.length; i++) {
        if (value <= domain[i]) {
            return range[i];
        }
    }
    return range[range.length - 1];
}

export async function map_stdev(map) {
    // Leer el archivo  
    const response = await fetch('/assets/vec/raster/NDVI_pixel/NDVI_StdDev/NDVI_Monthly_StdDev_UR.tif');
    const arrayBuffer = await response.arrayBuffer();
  
    // Parsear el georaster
    const georaster = await parseGeoraster(arrayBuffer);
  
    // Crear la capa de GeoRaster con los colores interpolados
    const Layer = new GeoRasterLayer({
        georaster: georaster,
              pixelValuesToColorFn: values => {
            const Value = values[0];
            if (isNaN(Value)) {
                return null; // Retornar null si el valor es NaN
            }
            return valueToDevColor(Value); // Colores interpolados con la paleta de verde, naranja y rojo
        },
        resolution: 1080
    });
  
    // No agregar la capa al mapa aquí, solo retornarla
    return Layer;
}

export function createDevLegendSVG() {
    // Definir los valores de la leyenda
    const values = [-0.1, -0.05, 0, 0.05, 0.1];
    
    // Colores seleccionados para armonía (6 colores)
    const colors = [
        "#008000",  // Primer color
        "#799300",  // Tercer color
        "#c8a100",  // Quinto color
        "#ec9400",  // Séptimo color
        "#ff5f00",  // Noveno color
        "#ff0000"   // Último color
    ];

    // Crear los elementos de la leyenda
    const legendItems = values.map((value, index) => {
        const color = colors[index];
        const yPosition = 25 + index * 30;
        const label = `${Math.round(value * 100) / 100}`;

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    return `
        <svg width="100" height="220" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="11" font-family="Arial">Desviación Estándar</text>
            ${legendItems}
        </svg>
    `;
}


