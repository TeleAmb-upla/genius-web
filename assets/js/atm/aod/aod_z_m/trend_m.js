import { geniusTitleForProduct } from '../../../map_data_catalog.js';
import {
    trendLegendSpec,
    trendColorFromValue,
    fillZonalTrendLegendPanel,
} from '../../../trend_scale.js';
import { geniusPrepareExclusiveGeoPopup } from '../../../maplibre_exclusive_geo_popup.js';
function valueToSTColor(value) {
    const spec = trendLegendSpec('aod', 'zonalManzana');
    if (!spec) return 'rgba(0,0,0,0)';
    return trendColorFromValue(value, spec) ?? 'rgba(0,0,0,0)';
}

export async function map_trend(map) {
    const geojsonUrl = resolveAssetUrl('assets/data/geojson/AOD/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Manzanas/Trend_AOD_ZonalStats_Manzanas.geojson');
    const propertyName = 'slope_median';

    // Eliminar la fuente y la capa si ya existen
    if (map.getSource('generic-trend')) {
        map.removeLayer('generic-trend-layer');
        map.removeSource('generic-trend');
    }

    const response = await fetch(geojsonUrl);
    const geojsonData = await response.json();

    geojsonData.features.forEach(feature => {
        const value = feature.properties[propertyName];
        const n = value == null ? NaN : Number(value);
        if (Number.isNaN(n)) {
            feature.properties.color = 'rgba(0,0,0,0)';
            feature.properties.trendOutline = 'rgba(0,0,0,0)';
        } else {
            feature.properties.color = valueToSTColor(n);
            feature.properties.trendOutline = '#000000';
        }
    });

    // Agregar la fuente y la capa con los colores definidos
    map.addSource('generic-trend', {
        type: 'geojson',
        data: geojsonData,
    });

    map.addLayer({
        id: 'generic-trend-layer',
        type: 'fill',
        source: 'generic-trend',
        paint: {
            'fill-opacity': 1,
            'fill-color': ['get', 'color'], // Usar el color precalculado
            'fill-outline-color': ['get', 'trendOutline']
        }
    });

    // Evento de clic para mostrar un popup con información de la capa
    map.on('click', 'generic-trend-layer', (e) => {
        const properties = e.features[0].properties;

        const popup = new maplibregl.Popup({ className: 'geo-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`
                <div class="popup-title">${properties.TOTAL_PERS != null ? properties.TOTAL_PERS : 'Manzana'}</div>
                <div class="popup-row"><span class="popup-label">Tendencia</span><span class="popup-value">${properties.slope_median != null && !Number.isNaN(Number(properties.slope_median)) ? Number(properties.slope_median).toFixed(4) : 'Sin datos'}</span></div>
            `);
        geniusPrepareExclusiveGeoPopup(popup);
        popup.addTo(map);
    });

    // Cambiar el cursor al pasar el ratón sobre la capa
    map.on('mouseenter', 'generic-trend-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
    });

    map.on('mouseleave', 'generic-trend-layer', () => {
        map.getCanvas().style.cursor = '';
    });

    // Significance info box
    const container = map.getContainer();
    if (!container.querySelector('.trend-significance-box')) {
        const infoBox = document.createElement('div');
        infoBox.className = 'trend-significance-box';
        infoBox.textContent = 'Las zonas sin tendencia estadísticamente significativa (p > 0.025) no se rellenan en el mapa vectorial; el raster puede mostrar píxeles sin la misma máscara de significancia.';
        container.appendChild(infoBox);
    }
}



export function createTrendLegend() {
    const legendContent = document.createElement('div');
    legendContent.id = 'trendLegend';
    legendContent.className = 'map-legend-panel';

    const title = document.createElement('div');
    title.textContent = geniusTitleForProduct('Tendencia AOD Manzanas', 'aod');
    title.className = 'map-legend-panel__title';
    fillZonalTrendLegendPanel(legendContent, title, 'aod', 'zonalManzana', {
        steps: 7,
        decimals: 2,
    });

    return legendContent;
}

  