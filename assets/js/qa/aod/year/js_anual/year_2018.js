import { ToColorYear } from '../palette_year.js';

export async function map_2018(map) {
    // Leer el archivo NDVI 2017
    const response = await fetch('/assets/vec/raster/aod_pixel/AOD_Yearly/AOD_Yearly_2018.tif');
    const arrayBuffer = await response.arrayBuffer();

    // Parsear el georaster
    const georaster = await parseGeoraster(arrayBuffer);

    // Crear la capa de GeoRaster
    const Layer = new GeoRasterLayer({
        georaster: georaster,
        opacity: 0.7,
        pixelValuesToColorFn: values => {
            const Value = values[0];
            // Si el valor es NaN, retorna null para hacerlo transparente
            if (isNaN(Value)) {
                return null;
            }
            // De lo contrario, utiliza la función ndviToColor
            return ToColorYear(Value);
        },
        resolution: 1080
    
    });

    // No agregar la capa al mapa aquí, solo retornarla
    return Layer;
}