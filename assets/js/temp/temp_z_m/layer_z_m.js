import { ToColorYear_z_m } from './ndvi_palette_z_m_y.js'; 
import { ToColorMonth_z_m } from './ndvi_palette_z_m_m.js';


export async function preprocessGeoJSON(url, currentMode) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`);
        const data = await response.json();
        data.features.forEach(feature => {
            if (feature.properties && feature.properties.LST_mean !== undefined) {
                feature.properties.color = currentMode === 'yearly' 
                    ? ToColorYear_z_m(feature.properties.LST_mean)
                    : ToColorMonth_z_m(feature.properties.LST_mean);
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
    const url = resolveAssetUrl(`assets/data/geojson/LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Manzanas/LST_Yearly_ZonalStats_Manzanas_${year}.geojson`);
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
        const value = properties.LST_mean;
        new maplibregl.Popup({ className: 'geo-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`
                <div class="popup-title">${properties.NOMBRE || 'Manzana'}</div>
                <div class="popup-row"><span class="popup-label">Año</span><span class="popup-value">${properties.Year}</span></div>
                <div class="popup-row"><span class="popup-label">LST (°C)</span><span class="popup-value">${value != null && !isNaN(value) ? Number(value).toFixed(1) : 'Sin datos'}</span></div>
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
    const url = resolveAssetUrl(`assets/data/geojson/LST/LST_Monthly_ZonalStats/LST_Monthly_ZonalStats_Manzanas/LST_Monthly_ZonalStats_Manzanas_${month}.geojson`)
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
        const value = properties.LST_mean;
        new maplibregl.Popup({ className: 'geo-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`
                <div class="popup-title">${properties.NOMBRE || 'Manzana'}</div>
                <div class="popup-row"><span class="popup-label">Mes</span><span class="popup-value">${properties.Month}</span></div>
                <div class="popup-row"><span class="popup-label">LST (°C)</span><span class="popup-value">${value != null && !isNaN(value) ? Number(value).toFixed(1) : 'Sin datos'}</span></div>
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