export async function m_noche(map) {
    try {
        // Leer el archivo GeoJSON
        const response = await fetch('/assets/vec/raster/multi/PlazaVieja_Noche_Class.geojson');
        const data = await response.json();

        // Mapeo de gridcode a etiquetas descriptivas
        const luminosidadLabelsNoche = {
            2: 'Baja',
            3: 'Media',
            4: 'Alta'
        };

        // Crear la capa GeoJSON con estilos basados en la propiedad gridcode
        const geojsonLayer = L.geoJSON(data, {
            style: function (feature) {
                const gridcode = feature.properties.gridcode;
                let fillColor;
                let fillOpacity = 1; // Opacidad por defecto
                let interactive = true; // Por defecto, las características son interactivas

                switch (gridcode) {
                    case 2:
                        fillColor = '#000080'; // Azul marino (Baja)
                        break;
                    case 3:
                        fillColor = 'red'; // Rojo (Media)
                        break;
                    case 4:
                        fillColor = 'yellow'; // Amarillo (Alta)
                        break;
                    default:
                        fillColor = 'transparent';
                        fillOpacity = 0;
                        interactive = false; // Hacer no interactiva la característica
                        break;
                }

                return {
                    color: 'transparent', // Borde invisible
                    weight: 0,            // Sin grosor de borde
                    fillColor: fillColor,
                    fillOpacity: fillOpacity,
                    interactive: interactive // Establecer si la característica es interactiva
                };
            },
            onEachFeature: function (feature, layer) {
                // Solo agregar interactividad si la característica es interactiva
                if (layer.options.interactive) {
                    // Evento click
                    layer.on('click', function (e) {
                        const gridcode = feature.properties.gridcode;
                        const luminosidad = luminosidadLabelsNoche[gridcode] || 'Desconocida';

                        L.popup()
                            .setLatLng(e.latlng)
                            .setContent(`<strong>Luminosidad:</strong> ${luminosidad}`)
                            .openOn(map);
                    });

                    // Cambiar el cursor al pasar el mouse sobre la característica
                    layer.on('mouseover', function (e) {
                        e.target.setStyle({
                            weight: 2,
                            color: '#666',
                            fillOpacity: e.target.options.fillOpacity // Usar la opacidad definida
                        });
                        // Cambiar el cursor a pointer
                        map.getContainer().style.cursor = 'pointer';
                    });

                    // Restaurar el estilo al salir el mouse de la característica
                    layer.on('mouseout', function (e) {
                        geojsonLayer.resetStyle(e.target);
                        // Restaurar el cursor
                        map.getContainer().style.cursor = '';
                    });
                }
            }
        }); // Agregar la capa al mapa

        // Si tienes un objeto overlayMaps para gestionar capas adicionales, agrégalo aquí
        // overlayMaps["Luminosidad Noche"] = geojsonLayer;

        return geojsonLayer;
    } catch (error) {
        console.error('Error al cargar el archivo GeoJSON:', error);
    }
}
