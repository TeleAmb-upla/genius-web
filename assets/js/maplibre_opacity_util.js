/**
 * Ajusta opacidad de capas vectoriales NDVI/LST y tendencia en mapas MapLibre GL.
 */
export function applyOpacityToVectorTrendLayers(map, opacity) {
    if (!map.getStyle() || !map.getStyle().layers) return;
    const layers = map.getStyle().layers;
    layers.forEach((layer) => {
        if (!layer.id.startsWith('vectorLayer') && layer.id !== 'generic-trend-layer') {
            return;
        }
        const ml = map.getLayer(layer.id);
        if (!ml) return;
        const layerType = ml.type;
        if (layerType === 'fill') {
            map.setPaintProperty(layer.id, 'fill-opacity', opacity);
        } else if (layerType === 'line') {
            map.setPaintProperty(layer.id, 'line-opacity', opacity);
        } else if (layerType === 'symbol') {
            map.setPaintProperty(layer.id, 'icon-opacity', opacity);
            map.setPaintProperty(layer.id, 'text-opacity', opacity);
        } else if (layerType === 'raster') {
            map.setPaintProperty(layer.id, 'raster-opacity', opacity);
        }
    });
}
