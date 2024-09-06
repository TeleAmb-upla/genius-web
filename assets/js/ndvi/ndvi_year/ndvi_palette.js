export function ndviToColor(ndvi) {
    const minNDVI = -0.3359;  // Valor mínimo de NDVI
    const maxNDVI = 0.7422;   // Valor máximo de NDVI

    // Paleta de colores invertida que representa los diferentes valores de NDVI
    const palette = ['ff0000', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718',
        '74A901', '529400', '3E8601', '207401', '056201', '004C00', '023B01',
        '012E01', '011D01', '011301'];

    // Asignamos rangos de NDVI a los colores
    const ranges = [
        { min: minNDVI, max: -0.12028, color: `#${palette[0]}` },    // Color rojo
        { min: -0.12028, max: 0.09534, color: `#${palette[3]}` },   // Color amarillo claro
        { min: 0.09534, max: 0.31096, color: `#${palette[6]}` },    // Color verde claro
        { min: 0.31096, max: 0.52658, color: `#${palette[9]}` },    // Color verde
        { min: 0.52658, max: maxNDVI, color: `#${palette[15]}` }    // Color verde oscuro
    ];

    // Si el NDVI está fuera del rango, devolvemos el color mínimo o máximo
    if (ndvi <= minNDVI) {
        return ranges[0].color;
    }
    if (ndvi >= maxNDVI) {
        return ranges[ranges.length - 1].color;
    }

    // Asignar color basado en el rango al que pertenece el valor de NDVI
    for (let i = 0; i < ranges.length; i++) {
        if (ndvi >= ranges[i].min && ndvi < ranges[i].max) {
            return ranges[i].color;
        }
    }

    // Retorna el color correspondiente al NDVI si no entra en ningún rango (caso extraño)
    return ranges[0].color; // Fallback al color mínimo
}
