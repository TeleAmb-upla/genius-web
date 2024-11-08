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

// Función para cargar datos GeoJSON y configurar capas
export async function loadinf_critica(currentMap) {
    try {
        // Fetch del archivo GeoJSON
        const response = await fetch('/assets/vec/capas/intraestructura_critica.geojson');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Obtener categorías únicas
        const categories = new Set();
        data.features.forEach(feature => {
            if (feature.properties.CATEGORIA) {
                categories.add(feature.properties.CATEGORIA);
            }
        });

        // Crear un objeto para almacenar las capas
        const categoryLayers = {};

        // Crear una capa para cada categoría
        categories.forEach(category => {
            // Filtrar las características para esta categoría
            const categoryFeatures = data.features.filter(feature => feature.properties.CATEGORIA === category);

            // Crear una capa GeoJSON para la categoría
            const layer = L.geoJSON(categoryFeatures, {
                pointToLayer: function (feature, latlng) {
                    return L.circleMarker(latlng, {
                        radius: 8,
                        fillColor: getCategoryColor(category),
                        color: '#000',           // Color del borde
                        weight: 1,               // Grosor del borde
                        opacity: 1,              // Opacidad del borde
                        fillOpacity: 0.8         // Opacidad del relleno
                    });
                },
                onEachFeature: function (feature, layer) {
                    const properties = feature.properties;
                    const tooltipContent = `
                        <strong>Categoria:</strong> ${properties.CATEGORIA}<br>
                        <strong>Sub-Categoría:</strong> ${properties.SUBCATEGOR}<br>
                        <strong>Nombre:</strong> ${properties.NOM_RBD}
                    `;
                    layer.bindTooltip(tooltipContent, {
                        direction: 'top',
                        offset: [0, -10],
                        opacity: 0.9
                    });
                }
            });

            // Añadir la capa al objeto de capas
            categoryLayers[category] = layer;
        });

        // Retornar las capas creadas
        return categoryLayers;

    } catch (error) {
        console.error('Error cargando datos:', error);
        return null; // Retornar null en caso de error
    }
}
