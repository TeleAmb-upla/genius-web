import { map_2018 } from './funtion/year_2018.js';
import { map_2019 } from './funtion/year_2019.js';
import { map_2020 } from './funtion/year_2020.js';
import { map_2021 } from './funtion/year_2021.js';
import { map_2022 } from './funtion/year_2022.js';
import { map_2023 } from './funtion/year_2023.js';
import { addCenteredTitle, createLegendSVG } from './funtion/map_utilities_p.js';
import { loadinf_critica } from '../inf_critica_leaflet.js';

// Variables globales
let currentMap = null;
let currentLayers = {}; // Objeto para almacenar las capas cargadas
let legendDiv = null; // Variable global para la leyenda
let infCriticaLayer = null; // Variable global para la capa de infraestructura crítica
let mapTitleDiv = null; // Variable global para el título del mapa
export async function map_hu() {
    // Elimina el mapa y la leyenda si ya están inicializados
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        currentLayers = {};  // Restablecer las capas cargadas

        // Eliminar el título del mapa si existe
        if (mapTitleDiv) {
            mapTitleDiv.remove();
            mapTitleDiv = null;
        }

        // Eliminar la leyenda si existe
        if (legendDiv) {
            legendDiv.remove();
            legendDiv = null;
        }
    }

    // Crear el mapa
    currentMap = L.map("p47").setView([-33.04752000, -71.44249000], 12.6);

    // Agregar el fondo del mapa
    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);

    // Agregar la escala
    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);

    // Inicializar `overlayMaps` antes de usarlo
    const overlayMaps = {};

    // Cargar las capas en orden inverso
    currentLayers["Huella Urbana 2023"] = await map_2023(currentMap);
    currentLayers["Huella Urbana 2022"] = await map_2022(currentMap);
    currentLayers["Huella Urbana 2021"] = await map_2021(currentMap);
    currentLayers["Huella Urbana 2020"] = await map_2020(currentMap);
    currentLayers["Huella Urbana 2019"] = await map_2019(currentMap);
    currentLayers["Huella Urbana 2018"] = await map_2018(currentMap);

    // Agregar las capas cargadas al objeto `overlayMaps`
    overlayMaps["Huella Urbana 2023"] = currentLayers["Huella Urbana 2023"];
    overlayMaps["Huella Urbana 2022"] = currentLayers["Huella Urbana 2022"];
    overlayMaps["Huella Urbana 2021"] = currentLayers["Huella Urbana 2021"];
    overlayMaps["Huella Urbana 2020"] = currentLayers["Huella Urbana 2020"];
    overlayMaps["Huella Urbana 2019"] = currentLayers["Huella Urbana 2019"];
    overlayMaps["Huella Urbana 2018"] = currentLayers["Huella Urbana 2018"];

    // Cargar la capa de infraestructura crítica pero NO agregarla automáticamente al mapa
    const infCriticaLayer = await loadinf_critica(currentMap);
    if (infCriticaLayer && typeof infCriticaLayer === 'object') {
        const layersArray = Object.values(infCriticaLayer);
        const infCriticaGroup = L.layerGroup(layersArray);
        overlayMaps["Infraestructura Crítica"] = infCriticaGroup;
        // No agregar: infCriticaGroup.addTo(currentMap);
    } else {
        console.error("La capa de infraestructura crítica no es un objeto de capa de Leaflet válido:", infCriticaLayer);
    }

    // Crear el control de capas y agregarlo al mapa
    L.control.layers(null, overlayMaps).addTo(currentMap);

    // Cargar y agregar el archivo GeoJSON al mapa
    fetch('/assets/vec/capas/PRC_Quilpue.geojson')
    .then(response => response.json())
    .then(geojsonData => {
        const geojsonLayer = L.geoJSON(geojsonData, {
            style: {
                color: "black",  // Establecer el color de los bordes
                weight: 1,       // Grosor de los bordes
                fillOpacity: 0   // Relleno completamente transparente
            },
            pointToLayer: function(feature, latlng) {
                return null; // No visualizar puntos
            }
        }).addTo(currentMap);
        currentLayers["GeoJSON Layer"] = geojsonLayer;
    })
    .catch(error => console.error('Error cargando el GeoJSON:', error));

    // Agregar el título centrado al mapa
    addCenteredTitle(currentMap);

    // Eliminar la leyenda anterior y crear una nueva
    if (legendDiv) {
        legendDiv.remove();
    }

    legendDiv = document.createElement('div');
    legendDiv.id = 'legend';
    legendDiv.style.position = 'absolute';
    legendDiv.style.top = '50%';  // Colocar en el centro vertical
    legendDiv.style.left = '10px';  // Colocar en la parte izquierda
    legendDiv.style.transform = 'translateY(-50%)';  // Ajustar para centrar verticalmente
    legendDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
    legendDiv.style.padding = '10px';
    legendDiv.style.borderRadius = '8px';
    legendDiv.style.zIndex = '1000';
    currentMap.getContainer().appendChild(legendDiv);

    // Agregar el SVG de la leyenda al contenedor div
    legendDiv.innerHTML = createLegendSVG(); // Llama a la función para crear el SVG de la leyenda
}
