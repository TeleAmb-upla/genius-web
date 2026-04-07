export function createMonthSelector(id) {
    const container = document.createElement('div');
    container.className = 'map-ui-temporal-panel';

    const label = document.createElement('label');
    label.innerText = 'Mes';
    label.htmlFor = id;
    container.appendChild(label);

    const selector = document.createElement('select');
    selector.id = id;
    for (let month = 1; month <= 12; month++) {
        const option = document.createElement('option');
        const monthStr = month.toString().padStart(2, '0'); // Asegurarse de que el mes tenga dos dígitos
        option.value = monthStr;
        option.text = monthStr;
        selector.appendChild(option);
    }
    container.appendChild(selector);

    return container;
}
export function positionMonthSelector(selector, position) {
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
