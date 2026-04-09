export async function map_2024(map) {
  const response = await fetch(resolveAssetUrl('assets/data/raster/Huella_Urbana/Huella_Urbana_Yearly_2024.tif'));
  const arrayBuffer = await response.arrayBuffer();
  const georaster = await parseGeoraster(arrayBuffer);

  const Layer = new GeoRasterLayer({
      georaster,
      pixelValuesToColorFn: (values) => {
          const Value = values[0];
          if (Value === 0 || Value === 2) return null;
          return '#a65628';
      },
      resolution: 384
  });

  return Layer;
}
