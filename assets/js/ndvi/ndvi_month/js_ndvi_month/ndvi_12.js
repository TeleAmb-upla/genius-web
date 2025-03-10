
import { ndviToColorMonth } from '../ndvi_palette_month.js'; // Ajusta la ruta según sea necesario

export async function map_ndvi_12(map) {
    // Leer el archivo NDVI 2016
    const response = await fetch('/assets/vec/raster/NDVI_pixel/NDVI_Monthly/NDVI_Monthly_12.tif');
    const arrayBuffer = await response.arrayBuffer();
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