function valueToSTColor(value) {
    // Definir los colores de la paleta
    const red = [255, 0, 0];    // Rojo
    const blue = [3, 19, 255];  // Azul
    const white = [255, 255, 255]; // Blanco

    let color = '#000000'; // Color por defecto en caso de error

    // Función para interpolar entre dos colores
    function interpolateColor(color1, color2, factor) {
        const result = color1.map((c1, i) => Math.round(c1 + factor * (color2[i] - c1)));
        return `rgb(${result[0]}, ${result[1]}, ${result[2]})`;
    }

    // Rango de umbrales
    const lowerNegativeLimit = -0.06;
    const upperNegativeLimit = -0.03;
    const lowerPositiveLimit = 0.03;
    const upperPositiveLimit = 0.06;

    // Valores negativos entre -0.06 y 0
    if (value < 0) {
        if (value >= lowerNegativeLimit && value < upperNegativeLimit) {
            // Degradado de rojo a blanco entre -0.06 y -0.03
            const normalizedValue = (value - lowerNegativeLimit) / (upperNegativeLimit - lowerNegativeLimit);
            color = interpolateColor(red, white, Math.min(normalizedValue, 1));
        } else if (value >= upperNegativeLimit && value <= 0) {
            // Degradado de rojo a blanco entre -0.03 y 0
            const normalizedValue = (value - upperNegativeLimit) / (0 - upperNegativeLimit);
            color = interpolateColor(red, white, Math.min(normalizedValue, 1));
        }
    }
    // Valores positivos entre 0 y 0.06
    else if (value > 0) {
        if (value > 0 && value <= lowerPositiveLimit) {
            // Degradado de blanco a azul entre 0 y 0.03
            const normalizedValue = (value - 0) / (lowerPositiveLimit - 0);
            color = interpolateColor(white, blue, Math.min(normalizedValue, 1));
        } else if (value > lowerPositiveLimit && value <= upperPositiveLimit) {
            // Degradado de blanco a azul entre 0.03 y 0.06
            const normalizedValue = (value - lowerPositiveLimit) / (upperPositiveLimit - lowerPositiveLimit);
            color = interpolateColor(white, blue, Math.min(normalizedValue, 1));
        }
    }
    // Si el valor es exactamente 0, el color será blanco
    else {
        color = 'rgb(255, 255, 255)';
    }

    return color;
}

export async function map_trend(map) {
  // Leer el archivo  
  const response = await fetch('/assets/vec/raster/NDVI_pixel/NDVI_Trend/NDVI_Yearly_Trend.tif');
  const arrayBuffer = await response.arrayBuffer();

  // Parsear el georaster
  const georaster = await parseGeoraster(arrayBuffer);

  // Crear la capa de GeoRaster con la nueva lógica de colores
  const Layer = new GeoRasterLayer({
      georaster: georaster,
      opacity: 0.7,
      pixelValuesToColorFn: values => {
          const Value = values[0];
          if (isNaN(Value)) {
              return null; // Retornar null si el valor es NaN
          }
          return valueToSTColor(Value); // Aplicar la función de colores según el valor
      },
      resolution: 1080
  });

  // No agregar la capa al mapa aquí, solo retornarla
  return Layer;
}
