import { getProductYears } from '../../../map_data_catalog.js';

export function createYearSelector(id) {
    const container = document.createElement('div');
    container.className = 'map-ui-temporal-panel';

    const label = document.createElement('label');
    label.innerText = 'Año';
    label.htmlFor = id;
    container.appendChild(label);

    const selector = document.createElement('select');
    selector.id = id;
    const years = getProductYears('ndvi_raster');
    for (const year of years) {
        const option = document.createElement('option');
        option.value = year;
        option.text = year;
        selector.appendChild(option);
    }
    if (/right|after/i.test(id) && years.length) {
        selector.value = String(years[years.length - 1]);
    } else if (years.length > 1) {
        selector.value = String(years[years.length - 2]);
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
