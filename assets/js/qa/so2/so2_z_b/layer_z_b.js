import { ToColorYear_z_b } from './ndvi_palette_z_b_y.js'; 
import { ToColorMonth_z_b } from './ndvi_palette_z_b_m.js';

export async function preprocessGeoJSON(url, currentMode) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`);
        const data = await response.json();
        data.features.forEach(feature => {
            if (feature.properties && feature.properties.SO2 !== undefined) {
                feature.properties.color = currentMode === 'yearly' 
                    ? ToColorYear_z_b(feature.properties.SO2)
                    : ToColorMonth_z_b(feature.properties.SO2);
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
    const url = `/assets/vec/vectoriales/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Barrios/SO2_Yearly_ZonalStats_Barrios_${year}.geojson`;
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
        const SO2Formatted = properties.SO2.toFixed(2);
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
                <strong>NOMBRE:</strong> ${properties.NOMBRE}<br>
                <strong>Año:</strong> ${properties.Year}<br>
                <strong>SO2:</strong> ${SO2Formatted}
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
    const url = `/assets/vec/vectoriales/SO2_Monthly_ZonalStats/SO2_Monthly_ZonalStats_Barrios/SO2_Monthly_ZonalStats_Barrios_${month}.geojson`;
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
        const SO2Formatted = properties.SO2.toFixed(2);
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
                <strong>MANZENT:</strong> ${properties.MANZENT}<br>
                <strong>TOTAL_PERS:</strong> ${properties.TOTAL_PERS}<br>
                <strong>Mes:</strong> ${properties.Month}<br>
                <strong>SO2:</strong> ${SO2Formatted}
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
