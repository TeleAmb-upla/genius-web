export function createYearLegend() {
    const legendContent = document.createElement('div');
    legendContent.id = 'yearLegend';
    legendContent.className = 'map-legend-panel';

    const title = document.createElement('div');
    title.textContent = 'Indicador de Vegetación';
    title.className = 'map-legend-panel__title';
    legendContent.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'NDVI Anual';
    subtitle.className = 'map-legend-panel__subtitle';
    legendContent.appendChild(subtitle);

    const domain = [0.082, 0.4219];
    const steps = 6;
    const colors = ['#ff0000', '#DF923D', '#FCD163', '#74A901', '#023B01', '#011301'];
    const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * ((domain[1] - domain[0]) / (steps - 1)));

    Values.forEach((value, index) => {
        if (index === Values.length - 1) return;
        const nextValue = Values[index + 1];
        const color = colors[index];

        const legendItem = document.createElement('div');
        legendItem.className = 'map-legend-panel__row';

        const colorBox = document.createElement('span');
        colorBox.className = 'map-legend-panel__swatch';
        colorBox.style.background = color;

        const label = document.createElement('span');
        label.className = 'map-legend-panel__label';
        label.textContent = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`;

        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContent.appendChild(legendItem);
    });

    return legendContent;
}

export function createMonthLegend() {
    const legendContent = document.createElement('div');
    legendContent.id = 'monthLegend';
    legendContent.className = 'map-legend-panel';

    const title = document.createElement('div');
    title.textContent = 'Indicador de Vegetación';
    title.className = 'map-legend-panel__title';
    legendContent.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'NDVI Mensual';
    subtitle.className = 'map-legend-panel__subtitle';
    legendContent.appendChild(subtitle);

    const domain = [0.0742, 0.4141];
    const steps = 6;
    const colors = ['#ff0000', '#DF923D', '#FCD163', '#74A901', '#023B01', '#011301'];
    const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * ((domain[1] - domain[0]) / (steps - 1)));

    Values.forEach((value, index) => {
        if (index === Values.length - 1) return;
        const nextValue = Values[index + 1];
        const color = colors[index];

        const legendItem = document.createElement('div');
        legendItem.className = 'map-legend-panel__row';

        const colorBox = document.createElement('span');
        colorBox.className = 'map-legend-panel__swatch';
        colorBox.style.background = color;

        const label = document.createElement('span');
        label.className = 'map-legend-panel__label';
        label.textContent = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`;

        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContent.appendChild(legendItem);
    });

    return legendContent;
}
