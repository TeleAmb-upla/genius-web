function valueToSTColor(value) {
    // Definir los colores de la paleta
    const green = [0, 128, 0];   // Verde
    const orange = [255, 165, 0]; // Naranja
    const red = [255, 0, 0];     // Rojo
    
    let color = '#000000'; // Color por defecto en caso de error

    // Función para interpolar entre dos colores
    function interpolateColor(color1, color2, factor) {
        const result = color1.map((c1, i) => Math.round(c1 + factor * (color2[i] - c1)));
        return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
    }

    // Definir el rango de valores que queremos mapear
    const minValue = 0;      // Valor mínimo esperado
    const maxValue = 0.18;   // Valor máximo esperado

    // Normalizar el valor para que esté en el rango de 0 a 1
    const normalizedValue = (value - minValue) / (maxValue - minValue);

    // Si el valor está en la primera mitad (verde a naranja)
    if (normalizedValue <= 0.5) {
        const factor = normalizedValue / 0.5; // Normalizamos dentro de este sub-rango
        color = interpolateColor(green, orange, factor);
    }
    // Si el valor está en la segunda mitad (naranja a rojo)
    else {
        const factor = (normalizedValue - 0.5) / 0.5; // Normalizamos dentro de este sub-rango
        color = interpolateColor(orange, red, factor);
    }

    return color;
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
        opacity: 0.7,
        pixelValuesToColorFn: values => {
            const Value = values[0];
            if (isNaN(Value)) {
                return null; // Retornar null si el valor es NaN
            }
            return valueToSTColor(Value); // Colores interpolados con la paleta de verde, naranja y rojo
        },
        resolution: 1080
    });
  
    // No agregar la capa al mapa aquí, solo retornarla
    return Layer;
}
