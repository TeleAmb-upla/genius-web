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
  // Leer el archivo  
  const response = await fetch('/assets/vec/raster/lst_pixel/lst_Trend/LST_Yearly_Trend.tif');
  const arrayBuffer = await response.arrayBuffer();

  // Parsear el georaster
  const georaster = await parseGeoraster(arrayBuffer);

  // Crear la capa de GeoRaster con un color fijo para 2018
  const Layer = new GeoRasterLayer({
      georaster: georaster,
      pixelValuesToColorFn: values => {
          const Value = values[0];
          if (isNaN(Value)) {
              return null; // Retornar null si el valor es NaN
          }
          return valueToSTColor(Value); // Rojo fijo para 2018
      },
      resolution: 1080
  });

  // No agregar la capa al mapa aquí, solo retornarla
  return Layer;
}
