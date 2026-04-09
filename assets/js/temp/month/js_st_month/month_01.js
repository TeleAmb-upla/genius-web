
import { ToColorMonth } from '../palette_month.js'; // Ajusta la ruta según sea necesario

export async function map_st_01(map) {
    // Leer el archivo  '/assets/data/raster/LST/LST_Monthly/LST_Monthly_01.tif
    const response = await fetch(resolveAssetUrl('assets/data/raster/LST/LST_Monthly/LST_Monthly_01.tif'));
    const arrayBuffer = await response.arrayBuffer();
    // Parsear el georaster
    const georaster = await parseGeoraster(arrayBuffer);

    // Crear la capa de GeoRaster
    const LST_median_layer = new GeoRasterLayer({
        georaster: georaster,
        pixelValuesToColorFn: values => {
            const LST_median = values[0];
            // Si el valor es NaN, retorna null para hacerlo transparente
            if (isNaN(LST_median)) {
                return null;
            }
            // De lo contrario, utiliza la función ndviToColor
            return ToColorMonth(LST_median);
        },
        resolution: 384
    });

    // No agregar la capa al mapa aquí, solo retornarla

    return { layer: LST_median_layer, georaster: georaster };
}