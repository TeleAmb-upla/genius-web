import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
// Función para asignar colores a los valores según el rango definido
function valueToSTColor(value) {
    const domain = [-9.88, 6.5];
    const range = [
        "#ff0000", // Rojo intenso para los valores negativos bajos
        "#ff3d66", // Rojo medio para valores negativos moderados
        "#ff75ad", // Rojo suave para valores negativos más cercanos a 0
        "#ffffff", // Blanco para el valor 0
        "#75aaff", // Azul claro para valores positivos bajos
        "#4d66ff", // Azul medio para valores positivos moderados
        "#0313ff"  // Azul intenso para valores positivos altos
    ].reverse();

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
    const geojsonUrl = resolveAssetUrl('assets/data/geojson/AOD/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Manzanas/Trend_AOD_ZonalStats_Manzanas.geojson');
    const propertyName = 'slope_median';

    // Eliminar la fuente y la capa si ya existen
    if (map.getSource('generic-trend')) {
        map.removeLayer('generic-trend-layer');
        map.removeSource('generic-trend');
    }

    const response = await fetch(geojsonUrl);
    const geojsonData = await response.json();

    // Aplicar los colores a cada feature basado en su valor
    geojsonData.features.forEach(feature => {
        const value = feature.properties[propertyName];
        feature.properties.color = valueToSTColor(value); // Asignar color calculado
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
                <strong>Rango de años:</strong> 2001 - 2024<br>
                <strong>Cantidad de Personas:</strong> ${properties.TOTAL_PERS || 'No disponible'}<br>
                <strong>Tendencia AOD:</strong> ${trendValue}<br>
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
    title.textContent = 'Tendencia AOD Manzanas';
    title.className = 'map-legend-panel__title';
    legendContent.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = '2001 - 2024';
    subtitle.className = 'map-legend-panel__subtitle';
    legendContent.appendChild(subtitle);

    const domain = [-9.88, 6.5];
    const steps = 7;
    const colors = ["#ff0000", "#ff3d66", "#ff75ad", "#ffffff", "#75aaff", "#4d66ff", "#0313ff"].reverse();
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

  