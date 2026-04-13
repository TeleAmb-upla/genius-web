import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { getProductYearRangeLabel } from '../../../map_data_catalog.js';

const no2RangeLabel = getProductYearRangeLabel('no2');
// Función para asignar colores a los valores según el rango definido
function valueToSTColor(value) {
    const domain = [-0.213, 0.098];
    const range = [
        "#0313ff",
        "#4d66ff",
        "#75aaff",
        "#ffffff",
        "#ff75ad",
        "#ff3d66",
        "#ff0000"
    ];

    // Calcular el índice con más precisión
    const step = (domain[1] - domain[0]) / (range.length - 1);

    if (value < domain[0]) {
        return range[0]; // Menor que el mínimo
    } 
    if (value > domain[1]) {
        return range[range.length - 1]; // Mayor que el máximo
    }

    // Calcular la posición exacta del índice y usar interpolación lineal si es necesario
    const index = (value - domain[0]) / step;
    const lowerIndex = Math.floor(index);
    const upperIndex = Math.min(lowerIndex + 1, range.length - 1);
    const fractionalPart = index - lowerIndex;

    // Interpolar entre colores si es necesario
    if (fractionalPart === 0) {
        return range[lowerIndex];
    }

    // Mezclar colores si estás entre dos índices
    return d3.interpolateRgb(range[lowerIndex], range[upperIndex])(fractionalPart);
}


export async function map_trend(map) {
    const geojsonUrl = resolveAssetUrl('assets/data/geojson/NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Manzanas/Trend_NO2_ZonalStats_Manzanas.geojson');
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

        new maplibregl.Popup({ className: 'geo-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`
                <div class="popup-title">${properties.TOTAL_PERS != null ? properties.TOTAL_PERS : 'Manzana'}</div>
                <div class="popup-row"><span class="popup-label">Tendencia</span><span class="popup-value">${properties.slope_median != null && !Number.isNaN(Number(properties.slope_median)) ? Number(properties.slope_median).toFixed(4) : 'Sin datos'}</span></div>
            `)
            .addTo(map);
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
    title.className = 'map-legend-panel__title';
    title.innerHTML = 'Tendencia NO<sub>2</sub> Manzanas';
    legendContent.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = no2RangeLabel;
    subtitle.className = 'map-legend-panel__subtitle';
    legendContent.appendChild(subtitle);

    const domain = [-0.3, 0.3];
    const steps = 7;
    const colors = ["#0313ff", "#4d66ff", "#75aaff", "#ffffff", "#ff75ad", "#ff3d66", "#ff0000"];
    const stepValue = (domain[1] - domain[0]) / (steps - 1);
    const values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

    values.forEach((value, index) => {
        const color = colors[index];
        const legendItem = document.createElement('div');
        legendItem.className = 'map-legend-panel__row';

        const colorBox = document.createElement('span');
        colorBox.className = 'map-legend-panel__swatch';
        colorBox.style.background = color;

        const label = document.createElement('span');
        label.className = 'map-legend-panel__label';
        if (index === 0) {
            label.textContent = `<${value.toFixed(2)}`;
        } else if (index === values.length - 1) {
            label.textContent = `>${value.toFixed(2)}`;
        } else {
            const nextValue = values[index + 1];
            label.textContent = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`;
        }

        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContent.appendChild(legendItem);
    });

    return legendContent;
}

  