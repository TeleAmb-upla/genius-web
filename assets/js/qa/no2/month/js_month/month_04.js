
import { ToColorMonth } from '../palette_month.js'; // Ajusta la ruta según sea necesario

export async function map_04(map) {
    // Leer el archivo 
    const response = await fetch('/assets/vec/raster/no2_pixel/NO2_Monthly/NO2_Monthly_04.tif');
    const arrayBuffer = await response.arrayBuffer();
    // Parsear el georaster
    const georaster = await parseGeoraster(arrayBuffer);

    // Crear la capa de GeoRaster
    const no2_median_layer = new GeoRasterLayer({
        georaster: georaster,
        opacity: 0.7,
        pixelValuesToColorFn: values => {
            const no2_median = values[0];
            // Si el valor es NaN, retorna null para hacerlo transparente
            if (isNaN(no2_median)) {
                return null;
            }
            // De lo contrario, utiliza la función ndviToColor
            return ToColorMonth(no2_median);
        },
        resolution: 1080
    });

    // No agregar la capa al mapa aquí, solo retornarla
    return { layer: no2_median_layer, georaster: georaster };
}