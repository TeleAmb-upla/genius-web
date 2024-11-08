// Define colores específicos para las categorías
const categoryColors = {
    "EDUCACION": "#1f77b4",           // Azul
    "SALUD": "#ff7f0e",               // Naranja
    "OTROS": "#2ca02c",               // Verde
    "CENTRO DEPORTIVO": "#d62728",    // Rojo

    // Agrega más categorías y colores según tus necesidades
};

// Función para obtener el color de una categoría
function getCategoryColor(category) {
    return categoryColors[category] || '#000000'; // Negro por defecto
}

export async function loadInfCriticaMapLibre(map) {
    try {
        // Verificar si la fuente ya existe
        if (map.getSource('infraestructuraCritica')) {
            // Verificar si las capas están visibles, si no lo están, mostrarlas
            const layers = map.getStyle().layers;
            layers.forEach(layer => {
                if (layer.id.startsWith('layer-') && !map.getLayoutProperty(layer.id, 'visibility')) {
                    map.setLayoutProperty(layer.id, 'visibility', 'visible');
                }
            });
            return; // No continuar cargando si ya existe
        }

        // Fetch del archivo GeoJSON
        const response = await fetch('/assets/vec/capas/intraestructura_critica.geojson');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Agregar la fuente de datos GeoJSON a MapLibre
        map.addSource('infraestructuraCritica', {
            type: 'geojson',
            data: data
        });

        // Obtener categorías únicas y agregar una capa por categoría
        const categories = new Set();
        data.features.forEach(feature => {
            if (feature.properties.CATEGORIA) {
                categories.add(feature.properties.CATEGORIA);
            }
        });

        categories.forEach(category => {
            map.addLayer({
                id: `layer-${category}`,
                type: 'circle',
                source: 'infraestructuraCritica',
                filter: ['==', ['get', 'CATEGORIA'], category],
                paint: {
                    'circle-radius': 8,
                    'circle-color': getCategoryColor(category),
                    'circle-stroke-color': '#000',
                    'circle-stroke-width': 1,
                    'circle-opacity': 0.8
                }
            });

            // Agregar un popup al hacer clic en un punto
            map.on('click', `layer-${category}`, (e) => {
                const coordinates = e.features[0].geometry.coordinates.slice();
                const properties = e.features[0].properties;
                const content = `
                    <strong>Categoria:</strong> ${properties.CATEGORIA}<br>
                    <strong>Sub-Categoría:</strong> ${properties.SUBCATEGOR}<br>
                    <strong>Nombre:</strong> ${properties.NOM_RBD}
                `;

                // Asegurarse de que el popup se muestre en la posición correcta
                while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
                    coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
                }

                new maplibregl.Popup()
                    .setLngLat(coordinates)
                    .setHTML(content)
                    .addTo(map);
            });

            // Cambiar el cursor al pasar por un punto
            map.on('mouseenter', `layer-${category}`, () => {
                map.getCanvas().style.cursor = 'pointer';
            });
            map.on('mouseleave', `layer-${category}`, () => {
                map.getCanvas().style.cursor = '';
            });
        });

    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

