export async function m_rgb(map) {
    try {
        const boundsResp = await fetch(resolveAssetUrl('assets/data/raster/Multicapa/PlazaVieja_Dia_RGB_bounds.json'));
        const imageResp = await fetch(resolveAssetUrl('assets/data/raster/Multicapa/PlazaVieja_Dia_RGB.webp'), { method: 'HEAD' });
        if (boundsResp.ok && imageResp.ok) {
            const boundsData = await boundsResp.json();
            return L.imageOverlay(
                resolveAssetUrl('assets/data/raster/Multicapa/PlazaVieja_Dia_RGB.webp'),
                boundsData.bounds,
                { opacity: 1 }
            );
        }
    } catch (error) {
        console.warn('No se pudo cargar el RGB optimizado:', error);
    }

    const response = await fetch(resolveAssetUrl('assets/data/raster/Multicapa/PlazaVieja_Dia_RGB.tif'));
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    const georaster = await parseGeoraster(arrayBuffer);

    return new GeoRasterLayer({
        georaster,
        resolution: 384,
        pixelValuesToColorFn(values) {
            const [r, g, b] = values;
            return `rgb(${r},${g},${b})`;
        }
    });
}