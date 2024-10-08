import { addCenteredTitle } from './map_utilities_p.js';

// Variables globales para almacenar el estado del mapa, las capas y el título
let currentMap = null;
let currentLayer = null;
let mapTitleDiv = null;

// Función para convertir el valor del raster a RGB (no se usa en este caso, pero puede ser útil para otras capas)
function valueToRGB(value) {
    if (value === 1 || isNaN(value) || value === null) {
        return null;
    }

    const minValue = 2;
    const maxValue = 5;
    const ratio = (value - minValue) / (maxValue - minValue);
    const r = Math.floor(255 * (1 - ratio));
    const g = Math.floor(255 * ratio);
    const b = Math.floor(255 * (ratio > 0.5 ? 2 * (1 - ratio) : 2 * ratio));

    return `rgb(${r}, ${g}, ${b})`;
}

// Función para inicializar el mapa y cargar el GeoJSON
export async function map_lum() {
    // Comprueba si el mapa ya está inicializado y elimínalo si es necesario
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        currentLayer = null;

        if (mapTitleDiv) {
            mapTitleDiv.remove();
            mapTitleDiv = null;
        }
    }

    // Crear el mapa
    currentMap = L.map("p46").setView([-33.04752000, -71.44249000], 12.6);

    // Agregar el fondo del mapa
    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);

    // Agregar la escala
    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);

    // Agregar el título centrado al mapa
    addCenteredTitle(currentMap);

    // Cargar el archivo GeoJSON
    try {
        const response = await fetch('/assets/vec/capas/ILU_RECLASS_VECTOR.json'); // Mal proyectado
        const data = await response.json();

        // Crear la capa GeoJSON y agregarla al mapa
        const geojsonLayer = L.geoJSON(data, {
            style: function (feature) {
                return {
                    color: 'black', // Color del borde
                    weight: 1, // Grosor del borde
                    fillOpacity: 0.5 // Transparencia del relleno
                };
            }
        }).addTo(currentMap);

        // Ajustar los límites del mapa según los datos GeoJSON cargados
        currentMap.fitBounds(geojsonLayer.getBounds());

    } catch (error) {
        console.error('Error al cargar el archivo GeoJSON:', error);
    }
}
