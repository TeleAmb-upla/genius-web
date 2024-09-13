import { addCenteredTitle } from './map_utilities_p.js';

// Variables globales para almacenar el estado del mapa y las capas
// Variables globales para almacenar el estado del mapa, las capas y el título
let currentMap = null;
let leftLayer = null;
let rightLayer = null;
let sideBySideControl = null;
let mapTitleDiv = null;
 let currentLayer = null;
// Función para convertir el valor del raster a RGB
function valueToRGB(value) {
    // Ignorar el valor 1 y devolver null para hacerlo transparente
    if (value === 1 || isNaN(value) || value === null) {
        return null; // Hacer el píxel transparente
    }

    const minValue = 2; // Valor mínimo para aplicar color
    const maxValue = 5; // Valor máximo para aplicar color

    // Normalizar el valor entre 0 y 1 dentro del rango especificado
    const ratio = (value - minValue) / (maxValue - minValue);

    // Convertir el ratio a un color RGB. Aquí utilizamos una gradación de rojo a azul.
    const r = Math.floor(255 * (1 - ratio));
    const g = Math.floor(255 * ratio);
    const b = Math.floor(255 * (ratio > 0.5 ? 2 * (1 - ratio) : 2 * ratio));

    return `rgb(${r}, ${g}, ${b})`;
}

// Función para inicializar el mapa sin la imagen TIFF
export async function map_lum() {
    // Comprueba si el mapa ya está inicializado y elimínalo si es necesario
    if (currentMap) {
        currentMap.remove(); // Eliminar el mapa existente
        currentMap = null; // Restablecer la variable para el mapa
        currentLayer = null; // Restablecer la variable para la capa

        // También eliminamos el título del mapa si existe
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
}