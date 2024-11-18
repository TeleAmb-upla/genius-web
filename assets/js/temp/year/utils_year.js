export function createYearSelector(id) {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.zIndex = '1000';
    container.style.backgroundColor = 'white';
    container.style.padding = '10px';
    container.style.borderRadius = '4px';
    container.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';

    const label = document.createElement('label');
    label.innerText = 'Seleccione un año';
    label.htmlFor = id;
    container.appendChild(label);

    const selector = document.createElement('select');
    selector.id = id;
    for (let year = 1997; year <= 2023; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.text = year;
        selector.appendChild(option);
    }
    container.appendChild(selector);

    return container;
}

export function positionYearSelector(selector, position) {
    const mapElement = document.getElementById('p10');
    if (position === 'left') {
        selector.style.bottom = '10px'; // Cambiado de 'top' a 'bottom'
        selector.style.left = '10px';
    } else if (position === 'right') {
        selector.style.bottom = '10px'; // Cambiado de 'top' a 'bottom'
        selector.style.right = '10px';
    }
    mapElement.appendChild(selector);
}
