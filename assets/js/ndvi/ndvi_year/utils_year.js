export function createYearSelector(id) {
    const container = document.createElement('div');
    container.className = 'map-ui-temporal-panel';

    const label = document.createElement('label');
    label.innerText = 'Año';
    label.htmlFor = id;
    container.appendChild(label);

    const selector = document.createElement('select');
    selector.id = id;
    const lastYear = new Date().getFullYear() - 1;
    for (let year = 2017; year <= lastYear; year++) {
        const option = document.createElement('option');
        option.value = year;
        option.text = year;
        selector.appendChild(option);
    }
    if (/right|after/i.test(id)) {
        selector.value = String(lastYear);
    } else {
        selector.value = String(Math.max(2017, lastYear - 1));
    }
    container.appendChild(selector);

    return container;
}

export function positionYearSelector(selector, position) {
    const mapElement = document.getElementById('p01');
    if (position === 'left') {
        selector.style.bottom = '10px'; // Cambiado de 'top' a 'bottom'
        selector.style.left = '10px';
    } else if (position === 'right') {
        selector.style.bottom = '10px'; // Cambiado de 'top' a 'bottom'
        selector.style.right = '10px';
    }
    mapElement.appendChild(selector);
}
