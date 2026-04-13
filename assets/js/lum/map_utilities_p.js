// Función para agregar o actualizar el título centrado al mapa
export function addCenteredTitle(map, titleText) {
    let mapTitleDiv = document.getElementById('map-title');
    if (!mapTitleDiv) {
        mapTitleDiv = document.createElement('div');
        mapTitleDiv.id = 'map-title';
        mapTitleDiv.className = 'map-title';
        map.getContainer().appendChild(mapTitleDiv);
    }
    const text = titleText !== undefined ? titleText : 'Luminacion Urbana 2024';
    mapTitleDiv.innerHTML = `<strong>${text}</strong>`;
}


