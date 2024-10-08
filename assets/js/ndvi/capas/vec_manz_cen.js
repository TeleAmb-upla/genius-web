// Función para cargar datos GeoJSON y configurar capas
export async function geojm_censales(currentMap) {
    try {
        const response = await fetch('/assets/vec/vectoriales/NDVI_Monthly_ZonalStats_Manzanas/NDVI_Monthly_ZonalStats_Manzanas_01.geojson');
        const data = await response.json();

        // Crear capa GeoJSON y agregarla al mapa
        const geojsonLayer = L.geoJSON(data, {
            style: function (feature) {
                return {
                    color: 'black', // Color del borde
                    weight: 1, // Grosor del borde (puedes ajustarlo a tu preferencia)
                    fillOpacity: 0, // Relleno completamente transparente
                };
            }
        }).addTo(currentMap);

        // Ajustar los límites del mapa según los datos cargados
        currentMap.fitBounds(geojsonLayer.getBounds());

    } catch (error) {
        console.error('Error al cargar el archivo GeoJSON:', error);
    }
}
