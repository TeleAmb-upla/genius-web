export async function m_rgb(map) {
    // Leer el archivo GeoTIFF
    const response = await fetch('/assets/vec/raster/multi/PlazaVieja_Dia_RGB.tif');
    const arrayBuffer = await response.arrayBuffer();

    // Parsear el GeoRaster
    const georaster = await parseGeoraster(arrayBuffer);

    // Crear la capa GeoRaster
    const layer = new GeoRasterLayer({
        georaster: georaster,
        resolution: 512, // Ajusta la resolución según sea necesario
        pixelValuesToColorFn: function (values) {
            // El archivo debe contener 3 bandas para R, G y B
            const [r, g, b] = values;
            return `rgb(${r},${g},${b})`;
        }
    });



    return layer;
}