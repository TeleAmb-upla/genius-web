import { ndviToColorYear_z_m } from './ndvi_palette_z_m_y.js';
import { ndviToColorMonth_z_m } from './ndvi_palette_z_m_m.js';
import {
    ndviManzanaPopupHtml,
    ndviManzanaPopupHtmlMonthly,
} from '../ndvi_zonal_explorer.js';
import { geniusPrepareExclusiveGeoPopup } from '../../maplibre_exclusive_geo_popup.js';

export async function preprocessGeoJSON(url, currentMode) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`);
        const data = await response.json();
        data.features.forEach(feature => {
            if (feature.properties && feature.properties.NDVI !== undefined) {
                feature.properties.color = currentMode === 'yearly' 
                    ? ndviToColorYear_z_m(feature.properties.NDVI)
                    : ndviToColorMonth_z_m(feature.properties.NDVI);
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
    const url = resolveAssetUrl(`assets/data/geojson/NDVI/NDVI_Yearly_ZonalStats/NDVI_Yearly_ZonalStats_Manzanas/NDVI_Yearly_ZonalStats_Manzanas_${year}.geojson`);
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
        const popup = new maplibregl.Popup({ className: 'geo-popup' })
            .setLngLat(e.lngLat)
            .setHTML(ndviManzanaPopupHtml(properties));
        geniusPrepareExclusiveGeoPopup(popup);
        popup.addTo(map);
    });

    map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
    });
}

export async function updateMapLayerMonth(map, sourceId, layerId, month) {
    const url = resolveAssetUrl(`assets/data/geojson/NDVI/NDVI_Monthly_ZonalStats/NDVI_Monthly_ZonalStats_Manzanas/NDVI_Monthly_ZonalStats_Manzanas_${month}.geojson`);
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
        const popup = new maplibregl.Popup({ className: 'geo-popup' })
            .setLngLat(e.lngLat)
            .setHTML(ndviManzanaPopupHtmlMonthly(properties));
        geniusPrepareExclusiveGeoPopup(popup);
        popup.addTo(map);
    });

    map.on('mouseenter', layerId, () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', layerId, () => {
        map.getCanvas().style.cursor = '';
    });
}
