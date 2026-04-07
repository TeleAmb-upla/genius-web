import { ndviToColorMonth } from '../ndvi_palette_month.js'; // Ajusta la ruta según sea necesario
import { fetchGeoTiffTryPaths } from '../../../raster_fetch.js';
import { candidatePathsNdviMonthly } from '../../ndvi_raster_paths.js';

export async function map_ndvi_10(map) {
    const arrayBuffer = await fetchGeoTiffTryPaths(candidatePathsNdviMonthly(10));
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
            return ndviToColorMonth(ndviValue);
        },
        resolution: 1080
    });

    // No agregar la capa al mapa aquí, solo retornarla
    return { layer: ndviLayer, georaster: georaster };
}