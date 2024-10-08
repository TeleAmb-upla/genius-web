import { ToColorYear_z_b } from './ndvi_palette_z_b_y.js'; 
import { ToColorMonth_z_b } from './ndvi_palette_z_b_m.js';

export async function preprocessGeoJSON(url, currentMode) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`);
        const data = await response.json();
        data.features.forEach(feature => {
            if (feature.properties && feature.properties.AOD_median !== undefined) {
                feature.properties.color = currentMode === 'yearly' 
                    ? ToColorYear_z_b(feature.properties.AOD_median)
                    : ToColorMonth_z_b(feature.properties.AOD_median);
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
    const url = `/assets/vec/vectoriales/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Barrios/AOD_Yearly_ZonalStats_Barrios_${year}.geojson`;
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
        const AOD_medianFormatted = properties.AOD_median.toFixed(2);
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
                <strong>Barrio:</strong> ${properties.NOMBRE}<br>
                <strong>Año:</strong> ${properties.Year}<br>
                <strong>AOD:</strong> ${AOD_medianFormatted}
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
    const url = `/assets/vec/vectoriales/AOD_Monthly_ZonalStats/AOD_Monthly_ZonalStats_Barrios/AOD_Monthly_ZonalStats_Barrios_${month}.geojson`;
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
        const AOD_medianFormatted = properties.AOD_median.toFixed(2);
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
                <strong>Barrio:</strong> ${properties.NOMBRE}<br>
                <strong>Mes:</strong> ${properties.Month}<br>
                <strong>AOD:</strong> ${AOD_medianFormatted}
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
