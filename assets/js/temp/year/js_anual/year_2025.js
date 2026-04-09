import { ToColorYear } from '../palette_year.js';

export async function map_2025(map) {
    const response = await fetch(resolveAssetUrl('assets/data/raster/LST/LST_Yearly/LST_Yearly_2025.tif'));
    const arrayBuffer = await response.arrayBuffer();
    const georaster = await parseGeoraster(arrayBuffer);

    const Layer = new GeoRasterLayer({
        georaster,
        pixelValuesToColorFn: (values) => {
            const Value = values[0];
            if (isNaN(Value)) {
                return null;
            }
            return ToColorYear(Value);
        },
        resolution: 384,
    });

    return { layer: Layer, georaster };
}
