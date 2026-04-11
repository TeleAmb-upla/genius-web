import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { getProductYears } from '../../map_data_catalog.js';

const lstYears = getProductYears('lst');
const lstRangeLabel = `${lstYears[0]} - ${lstYears[lstYears.length - 1]}`;

// Función para asignar colores a los valores según el rango definido
function valueToSTColor(value) {
    const domain = [0.013, 0.206];
    const range = [
        "#FFF2ED", "#FFB6B2", "#FF7977", "#FF3D3B", "#FF0000"
    ];
    
    // Calcular el paso entre cada color en función del dominio
    const step = (domain[1] - domain[0]) / (range.length - 1);
    
    // Asignar los colores basado en el valor
    if (value < domain[0]) {
        return range[0]; // Si es menor que el mínimo, devolver el primer color
    } 
    if (value > domain[1]) {
        return range[range.length - 1]; // Si es mayor que el máximo, devolver el último color
    }
    
    // Encontrar el color adecuado dentro del rango
    const index = Math.floor((value - domain[0]) / step);
    return range[index];
    }

export async function map_trend(map) {
    const geojsonUrl = resolveAssetUrl('assets/data/geojson/LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Barrios/Trend_LST_ZonalStats_Barrios.geojson');
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
        const value = properties[propertyName];

        new maplibregl.Popup({ className: 'geo-popup' })
            .setLngLat(e.lngLat)
            .setHTML(`
                <div class="popup-title">${properties.NOMBRE || 'Barrio'}</div>
                <div class="popup-row"><span class="popup-label">Período</span><span class="popup-value">${lstRangeLabel}</span></div>
                <div class="popup-row"><span class="popup-label">Tendencia (°C/año)</span><span class="popup-value">${value != null && !Number.isNaN(Number(value)) ? Number(value).toFixed(1) : 'Sin datos'}</span></div>
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
    title.textContent = 'Tendencia LST(°C) Barrios';
    title.className = 'map-legend-panel__title';
    legendContent.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = lstRangeLabel;
    subtitle.className = 'map-legend-panel__subtitle';
    legendContent.appendChild(subtitle);

    const domain = [0.013, 0.206];
    const steps = 5;
    const colors = ['#FFF2ED', '#FFB6B2', '#FF7977', '#FF3D3B', '#FF0000'];
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

  