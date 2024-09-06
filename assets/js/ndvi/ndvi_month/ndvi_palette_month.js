export function ndviToColorMonth(ndvi) {
    const minNDVI = -0.3281;
    const maxNDVI = 0.7969;

    // Definir la paleta de colores
    const palette = ['#FFFFFF', '#CE7E45', '#DF923D', '#F1B555', '#FCD163', '#99B718',
        '#74A901', '#66A000', '#529400', '#3E8601', '#207401', '#056201',
        '#004C00', '#023B01', '#012E01', '#011D01', '#011301'];

    let color = '#000000'; // Color por defecto en caso de error

    // Asegurarse de que el valor de NDVI esté dentro del rango
    if (ndvi < minNDVI) ndvi = minNDVI;
    if (ndvi > maxNDVI) ndvi = maxNDVI;

    // Normalizar el valor de NDVI dentro del rango [minNDVI, maxNDVI]
    const ratio = (ndvi - minNDVI) / (maxNDVI - minNDVI);

    // Calcular el índice de la paleta correspondiente
    const colorIndex = Math.floor(ratio * (palette.length - 1));

    // Asignar el color de la paleta
    color = palette[colorIndex];

    return color;
}
// Compare this snippet from assets/js/temp/month/palette_month.js: