import { ToColorYear_z_b } from './ndvi_palette_z_b_y.js'; 
import { ToColorMonth_z_b } from './ndvi_palette_z_b_m.js';
import { so2UmolForDisplay } from '../so2_units.js';

export async function preprocessGeoJSON(url, currentMode) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`);
        const data = await response.json();
        data.features.forEach(feature => {
            if (!feature.properties || feature.properties.SO2 === undefined || feature.properties.SO2 === null) {
                return;
            }
            const vU = so2UmolForDisplay(feature.properties.SO2);
            if (vU == null) {
                feature.properties.color = 'rgba(0,0,0,0)';
                return;
            }
            feature.properties.color = currentMode === 'yearly'
                ? ToColorYear_z_b(vU)
                : ToColorMonth_z_b(vU);
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
    const url = resolveAssetUrl(`assets/data/geojson/SO2/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Barrios/SO2_Yearly_ZonalStats_Barrios_${year}.geojson`);
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
        const vU = so2UmolForDisplay(properties.SO2);
        new maplibregl.Popup({ className: 'geo-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`
                <div class="popup-title">${properties.NOMBRE || properties.MANZENT || 'Barrio'}</div>
                <div class="popup-row"><span class="popup-label">Año</span><span class="popup-value">${properties.Year}</span></div>
                <div class="popup-row"><span class="popup-label">SO₂ (µmol/m²)</span><span class="popup-value">${vU != null ? vU.toFixed(2) : 'Sin datos'}</span></div>
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
    const url = resolveAssetUrl(`assets/data/geojson/SO2/SO2_Monthly_ZonalStats/SO2_Monthly_ZonalStats_Barrios/SO2_Monthly_ZonalStats_Barrios_${month}.geojson`);
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
        const vU = so2UmolForDisplay(properties.SO2);
        new maplibregl.Popup({ className: 'geo-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`
                <div class="popup-title">${properties.NOMBRE || properties.MANZENT || 'Barrio'}</div>
                <div class="popup-row"><span class="popup-label">Mes</span><span class="popup-value">${properties.Month}</span></div>
                <div class="popup-row"><span class="popup-label">SO₂ (µmol/m²)</span><span class="popup-value">${vU != null ? vU.toFixed(2) : 'Sin datos'}</span></div>
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
