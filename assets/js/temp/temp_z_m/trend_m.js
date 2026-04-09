import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { getProductYears } from '../../map_data_catalog.js';

const lstYears = getProductYears('lst');
const lstRangeLabel = `${lstYears[0]} - ${lstYears[lstYears.length - 1]}`;

// Función para asignar colores a los valores según el rango definido
function valueToSTColor(value) {
    const domain = [0, 0.303];
    // Paleta de colores invertida que representa los diferentes valores de NDVI
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
    const geojsonUrl = resolveAssetUrl('assets/data/geojson/LST/LST_Yearly_ZonalStats_Manzanas/Trend_LST_ZonalStats_Manzanas.geojson');
    const propertyName = 'slope_median'; // Cambiado a 'slope_median'

    // Eliminar la fuente y la capa si ya existen
    if (map.getSource('generic-trend')) {
        map.removeLayer('generic-trend-layer');
        map.removeSource('generic-trend');
    }

    const response = await fetch(geojsonUrl);
    const geojsonData = await response.json();

    // Aplicar los colores a cada feature basado en el valor de 'slope_median'
    geojsonData.features.forEach(feature => {
        const value = feature.properties[propertyName];
        feature.properties.color = valueToSTColor(value); // Asignar color calculado basado en 'slope_median'
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
            'fill-outline-color': 'black'    // Borde negro
        }
    });

    // Evento de clic para mostrar un popup con información de la capa
    map.on('click', 'generic-trend-layer', (e) => {
        const properties = e.features[0].properties;
        const trendValue = properties[propertyName] ? properties[propertyName].toFixed(2) : 'No disponible';

        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
                <strong>Rango de años:</strong> ${lstRangeLabel}<br>
                <strong>Cantidad de Personas:</strong> ${properties.TOTAL_PERS || 'No disponible'}<br>
                <strong>Tendencia LST:</strong> ${trendValue}<br>
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
}



export function createTrendLegend() {
    const legendContent = document.createElement('div');
    legendContent.id = 'trendLegend';
    legendContent.className = 'map-legend-panel';

    const title = document.createElement('div');
    title.textContent = 'Tendencia LST(C°) Manzanas';
    title.className = 'map-legend-panel__title';
    legendContent.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = lstRangeLabel;
    subtitle.className = 'map-legend-panel__subtitle';
    legendContent.appendChild(subtitle);

    const domain = [0, 0.303];
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

  