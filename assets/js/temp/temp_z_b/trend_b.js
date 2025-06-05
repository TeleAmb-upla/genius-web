import * as d3 from 'https://cdn.skypack.dev/d3@7';

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
    const geojsonUrl = '/assets/vec/vectoriales/LST_Yearly_ZonalStats_Barrios/Trend_LST_ZonalStats_Barrios.geojson';
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
                <strong>Rango de años:</strong> 1995 - 2024 <br>
                <strong>Nombre del Barrio:</strong> ${properties.NOMBRE || 'No disponible'}<br>
                <strong>Tendencia LST:</strong> ${properties.slope_median.toFixed(2)}<br>

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

    // Título de la leyenda
    const title = document.createElement('div');
    title.textContent = 'Tendencia LST(°C) Barrios';
    title.style.fontSize = '12px';
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '3px';
    legendContent.appendChild(title);

    // Subtítulo de la leyenda
    const subtitle = document.createElement('div');
    subtitle.textContent = '1995 - 2024';
    subtitle.style.fontSize = '10px';
    subtitle.style.color = '#555';
    subtitle.style.marginBottom = '5px';
    legendContent.appendChild(subtitle);

    // Configuración de dominio y colores de la leyenda
    const domain = [0.013, 0.206];
    const steps = 5; // Solo 7 rangos
    const colors = [ "#FFF2ED", "#FFB6B2", "#FF7977", "#FF3D3B", "#FF0000"];
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

  