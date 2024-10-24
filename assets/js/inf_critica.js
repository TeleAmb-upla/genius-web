// Mapa de nombres de categorías a nombres amigables
const categoryNames = {
    "CENTRO DEPORTIVO": "Centro Deportivo",
    "EDUCACION": "Educación",
    "OTROS": "OTROS",
    "SALUD": "Salud",
};

// Función para cargar datos GeoJSON y configurar capas
export async function loadinf_critica(currentMap) {
    try {
        const response = await fetch('/assets/vec/capas/infraestructura_critica.geojson');
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
            const layerName = categoryNames[category] || category;

            categoryLayers[layerName] = L.geoJSON(data, {
                filter: feature => feature.properties.CATEGORIA === category,
                style: function (feature) {
                    return {
                        color: '#000000',   // Color del borde
                        weight: 1,          // Grosor del borde
                        opacity: 1,         // Opacidad del borde
                        fillColor: '#000000', // Color de relleno (puedes cambiar esto según sea necesario)
                        fillOpacity: 0.6    // Opacidad del relleno
                    };
                },
                onEachFeature: function (feature, layer) {
                    // Crear un tooltip para cada polígono
                    layer.on('mouseover', function (e) {
                        const properties = feature.properties;

                        const tooltipContent = `
                            <strong>CATEGORIA:</strong> ${categoryNames[properties.CATEGORIA] || properties.CATEGORIA}<br>
                        `;
                        layer.bindTooltip(tooltipContent).openTooltip(e.latlng);
                    });

                    layer.on('mouseout', function () {
                        layer.closeTooltip(); // Cerrar el tooltip cuando el mouse sale del polígono
                    });
                }
            });
        });

        // Devolver las capas para usarlas más tarde
        return categoryLayers;

    } catch (error) {
        console.error("Error al cargar el GeoJSON:", error);
    }
}
