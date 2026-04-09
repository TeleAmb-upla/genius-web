import { ndviToColor } from '../ndvi_palette.js';
import { fetchGeoTiffTryPaths } from '../../../raster_fetch.js';
import { candidatePathsNdviYearly } from '../../ndvi_raster_paths.js';

export async function map_ndvi_2017(map) {
    const arrayBuffer = await fetchGeoTiffTryPaths(candidatePathsNdviYearly(2017));
    if (!arrayBuffer) {
        return { layer: null, georaster: null };
    }

    // Parsear el georaster
    const georaster = await parseGeoraster(arrayBuffer);

    // Crear la capa de GeoRaster
    const ndviLayer = new GeoRasterLayer({
        georaster: georaster,
        opacity: 0.7,
        pixelValuesToColorFn: values => {
            const ndviValue = values[0];
            // Si el valor es NaN, retorna null para hacerlo transparente
            if (isNaN(ndviValue)) {
                return null;
            }
            // De lo contrario, utiliza la función ndviToColor
            return ndviToColor(ndviValue);
        },
        resolution: 384
    });

    // Retornar tanto la capa como el georaster
    return { layer: ndviLayer, georaster: georaster };
}
