import * as d3 from 'https://cdn.skypack.dev/d3@7';
// Función para asignar colores a los valores según el rango definido
function valueToSTColor(value) {
    const domain = [-0.213, 0.098];
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
    const geojsonUrl = '/assets/vec/vectoriales/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Manzanas/Trend_NO2_ZonalStats_Manzanas.geojson';
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
                <strong>Rango de años:</strong> 2019 - 2023<br>
                <strong>Cantidad de Personas:</strong> ${properties.TOTAL_PERS || 'No disponible'}<br>
                <strong>Tendencia NO²:</strong> ${trendValue}<br>
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
    legendContent.style.position = 'absolute';
    legendContent.style.top = '50%';
    legendContent.style.left = '10px';
    legendContent.style.transform = 'translateY(-50%)';
    legendContent.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    legendContent.style.padding = '5px'; // Ajuste de padding
    legendContent.style.zIndex = '2';
    legendContent.style.border = '1px solid #ccc';
    legendContent.style.textAlign = 'left';
    legendContent.style.fontFamily = 'Arial, sans-serif';

    // Título de la leyenda con subíndice
    const title = document.createElement('div');
    title.innerHTML = 'Tendencia NO<sub>2</sub> Manzanas'; // Usar innerHTML para incluir el subíndice
    title.style.fontSize = '12px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '3px';
    legendContent.appendChild(title);

    // Subtítulo de la leyenda
    const subtitle = document.createElement('div');
    subtitle.textContent = '2016 - 2023';
    subtitle.style.fontSize = '10px';
    subtitle.style.color = '#555';
    subtitle.style.marginBottom = '5px';
    legendContent.appendChild(subtitle);

    // Configuración de dominio y colores de la leyenda
    const domain = [-0.3, 0.3];
    const steps = 7; // Solo 7 rangos
    const colors = ["#ff0000", "#ff3d66", "#ff75ad", "#ffffff", "#75aaff", "#4d66ff", "#0313ff"].reverse();
    const stepValue = (domain[1] - domain[0]) / (steps - 1);
    const values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

    // Generar elementos de la leyenda con rangos y colores
    values.forEach((value, index) => {
        const color = colors[index];

        const legendItem = document.createElement('div');
        legendItem.style.marginBottom = '2px';
        legendItem.style.display = 'flex';
        legendItem.style.alignItems = 'center';

        const colorBox = document.createElement('span');
        colorBox.style.background = color;
        colorBox.style.width = '15px';
        colorBox.style.height = '15px';
        colorBox.style.display = 'inline-block';
        colorBox.style.marginRight = '8px';
        colorBox.style.border = '0.5px solid black';

        const label = document.createElement('span');
        label.style.fontSize = '10px';

        // Rango de valores
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

  