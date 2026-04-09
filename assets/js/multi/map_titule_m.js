// Función para agregar o actualizar el título centrado al mapa
export function addCenteredTitle_noche(map) {
    let mapTitleDiv = document.getElementById('map-title');
    if (!mapTitleDiv) {
        mapTitleDiv = document.createElement('div');
        mapTitleDiv.id = 'map-title';
        mapTitleDiv.className = 'map-title';
        map.getContainer().appendChild(mapTitleDiv);
    }
    mapTitleDiv.innerHTML = `<strong>Iluminacion Clasificada Plaza Vieja</strong>`;
}


// Función para agregar o actualizar el título centrado al mapa
export function addCenteredTitle_rgb(map) {
    let mapTitleDiv = document.getElementById('map-title');
    if (!mapTitleDiv) {
        mapTitleDiv = document.createElement('div');
        mapTitleDiv.id = 'map-title';
        mapTitleDiv.className = 'map-title';
        map.getContainer().appendChild(mapTitleDiv);
    }
    mapTitleDiv.innerHTML = `<strong>Color Verdadero Plaza Vieja</strong>`;
}


// Función para agregar o actualizar el título centrado al mapa
export function addCenteredTitle_temp(map) {
    let mapTitleDiv = document.getElementById('map-title');
    if (!mapTitleDiv) {
        mapTitleDiv = document.createElement('div');
        mapTitleDiv.id = 'map-title';
        mapTitleDiv.className = 'map-title';
        map.getContainer().appendChild(mapTitleDiv);
    }
    mapTitleDiv.innerHTML = `<strong>Temperatura Plaza Vieja</strong>`;
}
