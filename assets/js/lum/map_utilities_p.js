import { mountGeniusLeafletMapTitle } from '../map_data_catalog.js';

// Función para agregar o actualizar el título centrado al mapa
export function addCenteredTitle(map, titleText, options = {}) {
    const text =
        titleText !== undefined ? titleText : 'Iluminación - Invierno 2024';
    mountGeniusLeafletMapTitle(map, text, options);
}