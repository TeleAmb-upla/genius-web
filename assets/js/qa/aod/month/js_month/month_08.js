
import { ToColorMonth } from '../palette_month.js'; // Ajusta la ruta según sea necesario

export async function map_08(map) {
    // Leer el archivo 
    const response = await fetch('/assets/vec/raster/aod_pixel/AOD_Monthly/AOD_Monthly_08.tif');
    const arrayBuffer = await response.arrayBuffer();
    // Parsear el georaster
    const georaster = await parseGeoraster(arrayBuffer);

    // Crear la capa de GeoRaster
    const media_layer = new GeoRasterLayer({
        georaster: georaster,
        opacity: 0.7,
        pixelValuesToColorFn: values => {
            const LST_median = values[0];
            // Si el valor es NaN, retorna null para hacerlo transparente
            if (isNaN(LST_median)) {
                return null;
            }
            // De lo contrario, utiliza la función ndviToColor
            return ToColorMonth(LST_median);
        },
        resolution: 1080
    });

    // No agregar la capa al mapa aquí, solo retornarla
    return { layer: media_layer, georaster: georaster };
}