// Función para asignar colores según la propiedad Clase
function getColorForClase(clase) {
    switch (clase) {
        case 0:
            return '#FFFFFF'; // Blanco
        case 1:
            return '#FFCCCC'; // Rojo ligero
        case 2:
            return '#FF6666'; // Rojo medio
        case 3:
            return '#FF0000'; // Rojo fuerte
        default:
            return '#000000'; // Negro para valores inesperados
    }
}

// Función para procesar el GeoJSON y asignar colores dinámicamente
export async function preprocessGeoJSON(url, currentMode) {
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`Failed to fetch data: ${response.statusText}`);
        const data = await response.json();

        // Asignar colores según la propiedad Clase
        data.features.forEach(feature => {
            const clase = feature.properties.Clase;
            feature.properties.color = getColorForClase(clase);
        });

        return data;
    } catch (error) {
        console.error('Error processing GeoJSON:', error);
        return null;
    }
}

// Función para eliminar capas y eventos existentes del mapa
function removeLayerAndEvents(map, layerId) {
    if (map.getLayer(layerId)) {
        map.off('click', layerId);
        map.off('mouseenter', layerId);
        map.off('mouseleave', layerId);
        map.removeLayer(layerId);
    }
}

// Función para eliminar fuentes existentes del mapa
function removeSource(map, sourceId) {
    if (map.getSource(sourceId)) {
        map.removeSource(sourceId);
    }
}

// Función para actualizar la capa del mapa con datos anuales
export async function updateMapLayerYear_isla(map, sourceId, layerId, year) {
    const url = `/assets/vec/vectoriales/LST_SUHI_Yearly/LST_SUHI_Yearly_${year}.geojson`;
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
            'fill-color': ['get', 'color'], // Utiliza el color definido en la propiedad color
            'fill-opacity': 1,
            'fill-outline-color': 'black' // Borde negro
        }
    });

    // Agregar eventos interactivos
    map.on('click', layerId, (e) => {
        const properties = e.features[0].properties;
        new maplibregl.Popup()
            .setLngLat(e.lngLat)
            .setHTML(`
                <strong>Año:</strong> ${properties.Year}<br>
                <strong>Clase:</strong> ${properties.Clase}<br>
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


// Ejemplo de uso
// Asegúrate de que `map` esté inicializado previamente
// updateMapLayerYear_isla(map, 'lst_suhi_source', 'lst_suhi_layer', 2023);