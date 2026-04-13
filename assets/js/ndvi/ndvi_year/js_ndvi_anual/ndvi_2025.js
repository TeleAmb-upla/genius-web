import { ndviToColor } from '../ndvi_palette.js';
import { fetchGeoTiffTryPaths } from '../../../raster_fetch.js';
import { candidatePathsNdviYearly } from '../../ndvi_raster_paths.js';

export async function map_ndvi_2025(map) {
    const arrayBuffer = await fetchGeoTiffTryPaths(candidatePathsNdviYearly(2025));
    if (!arrayBuffer) {
        return { layer: null, georaster: null };
    }

    const georaster = await parseGeoraster(arrayBuffer);
    const ndviLayer = new GeoRasterLayer({
        georaster,
        opacity: 0.7,
        pixelValuesToColorFn: (values) => {
            const ndviValue = values[0];
            if (isNaN(ndviValue)) {
                return null;
            }
            return ndviToColor(ndviValue);
        },
        resolution: 384,
    });

    return { layer: ndviLayer, georaster };
}
