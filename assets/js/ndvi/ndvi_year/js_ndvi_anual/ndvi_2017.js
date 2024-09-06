import { ndviToColor } from '../ndvi_palette.js';

export async function map_ndvi_2017(map) {
    // Leer el archivo NDVI 2017
    const response = await fetch('/assets/vec/raster/NDVI_pixel/NDVI_Yearly/NDVI_Yearly_2017.tif');
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
            return ndviToColor(ndviValue);
        },
        resolution: 1080
    
    });

    // No agregar la capa al mapa aquí, solo retornarla
    return ndviLayer;
}