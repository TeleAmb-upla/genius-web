export async function map_2025(map) {
  const response = await fetch(resolveAssetUrl('assets/data/raster/Huella_Urbana/Huella_Urbana_Yearly_2025.tif'));
  const arrayBuffer = await response.arrayBuffer();
  const georaster = await parseGeoraster(arrayBuffer);

  const Layer = new GeoRasterLayer({
      georaster,
      pixelValuesToColorFn: (values) => {
          const Value = values[0];
          if (Value === 0 || Value === 2) return null;
          return '#f781bf';
      },
      resolution: 384
  });

  return Layer;
}
