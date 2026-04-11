import { ToColorYear_z_b } from './ndvi_palette_z_b_y.js'; 
import { ToColorMonth_z_b } from './ndvi_palette_z_b_m.js';

export async function preprocessGeoJSON(url, currentMode) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`);
        const data = await response.json();
        data.features.forEach(feature => {
            if (feature.properties && feature.properties.NO2_median !== undefined) {
                feature.properties.color = currentMode === 'yearly'
                    ? ToColorYear_z_b(feature.properties.NO2_median)
                    : ToColorMonth_z_b(feature.properties.NO2_median);
            }
        });
        return data;
    } catch (error) {
        console.error('Error processing GeoJSON:', error);
        return null;
    }
}

function removeLayerAndEvents(map, layerId) {
    if (map.getLayer(layerId)) {
        map.off('click', layerId);
        map.off('mouseenter', layerId);
        map.off('mouseleave', layerId);
        map.removeLayer(layerId);
    }
}

function removeSource(map, sourceId) {
    if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
    }
}

export async function updateMapLayerYear(map, sourceId, layerId, year) {
    const url = resolveAssetUrl(`assets/data/geojson/NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Barrios/NO2_Yearly_ZonalStats_Barrios_${year}.geojson`);
    const data = await preprocessGeoJSON(url, 'yearly');
    if (!data) return;

    removeLayerAndEvents(map, layerId);
    removeSource(map, sourceId);

    map.addSource(sourceId, { type: 'geojson', data });
    map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 1,
            'fill-outline-color': 'black' // Borde negro
        }
    });

    map.on('click', layerId, (e) => {
        const properties = e.features[0].properties;
        const v = properties.NO2_median;
        new maplibregl.Popup({ className: 'geo-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`
                <div class="popup-title">${properties.NOMBRE || 'Barrio'}</div>
                <div class="popup-row"><span class="popup-label">Año</span><span class="popup-value">${properties.Year}</span></div>
                <div class="popup-row"><span class="popup-label">NO₂ (µg/m³)</span><span class="popup-value">${v != null ? v.toFixed(2) : 'Sin datos'}</span></div>
            `)
            .addTo(map);
    });

    map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
    });
}

export async function updateMapLayerMonth(map, sourceId, layerId, month) {
    const url = resolveAssetUrl(`assets/data/geojson/NO2/NO2_Monthly_ZonalStats/NO2_Monthly_ZonalStats_Barrios/NO2_Monthly_ZonalStats_Barrios_${month}.geojson`);
    const data = await preprocessGeoJSON(url, 'monthly');
    if (!data) return;

    removeLayerAndEvents(map, layerId);
    removeSource(map, sourceId);

    map.addSource(sourceId, { type: 'geojson', data });
    map.addLayer({
        id: layerId,
        type: 'fill',
        source: sourceId,
        paint: {
            'fill-color': ['get', 'color'],
            'fill-opacity': 1,
            'fill-outline-color': 'black' // Borde negro
        }
    });

    map.on('click', layerId, (e) => {
        const properties = e.features[0].properties;
        const v = properties.NO2_median;
        new maplibregl.Popup({ className: 'geo-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`
                <div class="popup-title">${properties.NOMBRE || 'Barrio'}</div>
                <div class="popup-row"><span class="popup-label">Mes</span><span class="popup-value">${properties.Month}</span></div>
                <div class="popup-row"><span class="popup-label">NO₂ (µg/m³)</span><span class="popup-value">${v != null ? v.toFixed(2) : 'Sin datos'}</span></div>
            `)
            .addTo(map);
    });

    map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
    });
}
