export async function map_trend(map) {
  // Leer el archivo  
  const response = await fetch('/assets/vec/raster/aod_pixel/AOD_Trend/AOD_Yearly_Trend.tif');
  const arrayBuffer = await response.arrayBuffer();

  // Parsear el georaster
  const georaster = await parseGeoraster(arrayBuffer);

  // Crear la capa de GeoRaster con un color fijo para 2018
  const Layer = new GeoRasterLayer({
      georaster: georaster,
      opacity: 0.7,
      pixelValuesToColorFn: values => {
          const Value = values[0];
          if (isNaN(Value)) {
              return null; // Retornar null si el valor es NaN
          }
          return '#ff7f00'; // Rojo fijo para 2018
      },
      resolution: 1080
  });

  // No agregar la capa al mapa aquí, solo retornarla
  return Layer;
}
