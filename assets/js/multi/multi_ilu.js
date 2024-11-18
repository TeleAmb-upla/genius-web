export async function m_noche(map) {
    // Leer el archivo GeoJSON
    const response = await fetch('/assets/vec/raster/multi/PlazaVieja_Noche_Class.geojson');
    const data = await response.json();

    // Crear la capa GeoJSON con estilos basados en la propiedad gridcode
    const geojsonLayer = L.geoJSON(data, {
        style: function (feature) {
            const gridcode = feature.properties.gridcode;
            let fillColor;
            let fillOpacity = 1; // Opacidad por defecto

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
            }

            return {
                color: 'transparent', // Borde invisible
                weight: 0,            // Sin grosor de borde
                fillColor: fillColor,
                fillOpacity: fillOpacity
            };
        }
    });



    return geojsonLayer;
}
