export async function map_2020(map) {
  // Leer el archivo  
  const response = await fetch('/assets/vec/raster/Huella_Urbana_Yearly/Huella_Urbana_Yearly_2020.tif');
  const arrayBuffer = await response.arrayBuffer();

  // Parsear el georaster
  const georaster = await parseGeoraster(arrayBuffer);

  // Crear la capa de GeoRaster con un color fijo para 2020
  const Layer = new GeoRasterLayer({
      georaster: georaster,
      pixelValuesToColorFn: values => {
          const Value = values[0];
          if (Value ==  0 ) return null;
          if (Value ==  2 ) return null; // Transparente si no hay datos
          return '#984ea3'; // Azul fijo para 2020
      },
      resolution: 1080
  });

  // No agregar la capa al mapa aquí, solo retornarla
  return Layer;
}
