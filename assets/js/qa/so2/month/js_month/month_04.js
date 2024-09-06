
import { ToColorMonth } from '../palette_month.js'; // Ajusta la ruta según sea necesario

export async function map_04(map) {
    // Leer el archivo 
    const response = await fetch('/assets/vec/raster/so2_pixel/SO2_Monthly/SO2_Monthly_04.tif');
    const arrayBuffer = await response.arrayBuffer();
    // Parsear el georaster
    const georaster = await parseGeoraster(arrayBuffer);

    // Crear la capa de GeoRaster
    const SO2_median_layer = new GeoRasterLayer({
        georaster: georaster,
        opacity: 0.7,
        pixelValuesToColorFn: values => {
            const SO2_median = values[0];
            // Si el valor es NaN, retorna null para hacerlo transparente
            if (isNaN(SO2_median)) {
                return null;
            }
            // De lo contrario, utiliza la función ndviToColor
            return ToColorMonth(SO2_median);
        },
        resolution: 1080
    });

    // SO agregar la capa al mapa aquí, solo retornarla
    return SO2_median_layer;
}