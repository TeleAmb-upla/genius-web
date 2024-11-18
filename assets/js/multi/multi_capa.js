import { m_noche } from './multi_ilu.js';
import { m_rgb } from './multi_rgb.js';
import { m_tem } from './multi_tem.js';
import { addCenteredTitle_noche, addCenteredTitle_rgb, addCenteredTitle_temp } from './map_titule_m.js';
import { addLegend_noche, addLegend_temp, removeLegend} from './map_legend_m.js';
// Variables globales
let currentMap = null;
let currentLayers = {}; // Objeto para almacenar las capas cargadas
let legendDiv = null; // Variable global para la leyenda
let overlayMaps = {}; // Objeto para las capas de superposición
let mapTitleDiv = null; // Variable global para el título del mapa

export async function multi_capa() {
    // Elimina el mapa y la leyenda si ya están inicializados
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        currentLayers = {}; // Restablecer las capas cargadas
        overlayMaps = {}; // Restablecer las capas de superposición

        // Eliminar la leyenda si existe
        if (legendDiv) {
            legendDiv.remove();
            legendDiv = null;
        }

        // Eliminar el título si existe
        if (mapTitleDiv) {
            mapTitleDiv.remove();
            mapTitleDiv = null;
        }
    }

    // Crear el mapa
    currentMap = L.map("p75");

    // Agregar el fondo del mapa
    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 23,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);

    // Agregar la escala
    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);

    // Variables para calcular la extensión de todas las capas
    let bounds = null;

    // Cargar las capas en orden adecuado
    currentLayers["Plaza Vieja Dia RGB"] = await m_rgb(currentMap);
    currentLayers["Plaza Vieja Dia Termico"] = await m_tem(currentMap);
    currentLayers["Plaza Vieja Noche"] = await m_noche(currentMap);

    // Agregar las capas cargadas al objeto `overlayMaps`
    overlayMaps["Plaza Vieja Dia RGB"] = currentLayers["Plaza Vieja Dia RGB"];
    overlayMaps["Plaza Vieja Dia Termico"] = currentLayers["Plaza Vieja Dia Termico"];
    overlayMaps["Plaza Vieja Noche"] = currentLayers["Plaza Vieja Noche"];

    // Mostrar solo la capa RGB al inicio
    currentMap.addLayer(currentLayers["Plaza Vieja Dia RGB"]);

    // Establecer el título inicial para la capa RGB
    addCenteredTitle_rgb(currentMap);

    // Calcular los límites de las capas
    Object.values(currentLayers).forEach(layer => {
        if (layer && layer.getBounds) {
            const layerBounds = layer.getBounds();
            bounds = bounds ? bounds.extend(layerBounds) : layerBounds;
        } else if (layer && layer.georaster) {
            // Caso específico para GeoRasterLayer
            const { xmin, ymin, xmax, ymax } = layer.georaster;
            const rasterBounds = L.latLngBounds(
                [ymin, xmin], // Esquina inferior izquierda
                [ymax, xmax]  // Esquina superior derecha
            );
            bounds = bounds ? bounds.extend(rasterBounds) : rasterBounds;
        }
    });

    // Centrar el mapa en los límites calculados
    if (bounds) {
        currentMap.fitBounds(bounds);
    } else {
        // Fallback: centrar manualmente si no hay límites disponibles
        currentMap.setView([-33.04752000, -71.44249000], 12.6);
    }

    // Agregar control de capas al mapa
    const layerControl = L.control.layers(null, overlayMaps).addTo(currentMap);

    // Actualizar el título dinámicamente según la capa seleccionada
    currentMap.on('overlayadd', function (event) {
        switch (event.name) {
            case "Plaza Vieja Dia RGB":
                addCenteredTitle_rgb(currentMap);
                break;
            case "Plaza Vieja Dia Termico":
                addCenteredTitle_temp(currentMap);      
                addLegend_temp(currentMap);
                break;
            case "Plaza Vieja Noche":
                addCenteredTitle_noche(currentMap);
                addLegend_noche(currentMap);
                break;
        }
    });

    currentMap.on('overlayremove', function () {
        removeLegend(currentMap); // Eliminar leyenda al quitar capa
    });
    
}
