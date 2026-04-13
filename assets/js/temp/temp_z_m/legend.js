export function createYearLegend() {
    const legendContent = document.createElement('div');
    legendContent.id = 'yearLegend';
    legendContent.className = 'map-legend-panel';

    const title = document.createElement('div');
    title.textContent = 'Temperatura Superficial';
    title.className = 'map-legend-panel__title';
    legendContent.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'LST (°C) Anual';
    subtitle.className = 'map-legend-panel__subtitle';
    legendContent.appendChild(subtitle);

    const domain = [17, 40];
    const steps = 18;
    const stepValue = (domain[1] - domain[0]) / (steps - 1);
    const colors = [
        '#00008B', '#0000FF', '#1E90FF', '#00BFFF', '#00FFFF',
        '#7FFF00', '#32CD32', '#ADFF2F', '#FFFF00', '#FFD700',
        '#FFA500', '#FF8C00', '#FF4500', '#FF0000', '#DC143C',
        '#B22222', '#8B0000', '#800000',
    ];
    const values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

    values.forEach((value, index) => {
        const color = colors[index];
        const legendItem = document.createElement('div');
        legendItem.className = 'map-legend-panel__row';

        const colorBox = document.createElement('span');
        colorBox.className = 'map-legend-panel__swatch';
        colorBox.style.background = color;

        const label = document.createElement('span');
        label.className = 'map-legend-panel__label';
        if (index === 0) {
            label.textContent = '<22°';
        } else if (index === values.length - 1) {
            label.textContent = '>37°';
        } else {
            const nextValue = values[index + 1];
            label.textContent = `${value.toFixed(0)}° - ${nextValue.toFixed(0)}°`;
        }

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
    title.textContent = 'Temperatura Superficial';
    title.className = 'map-legend-panel__title';
    legendContent.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'LST (°C) Mensual';
    subtitle.className = 'map-legend-panel__subtitle';
    legendContent.appendChild(subtitle);

    const domain = [11.5, 43.5];
    const steps = 18;
    const stepValue = (domain[1] - domain[0]) / (steps - 1);
    const colors = [
        '#00008B', '#0000FF', '#1E90FF', '#00BFFF', '#00FFFF',
        '#7FFF00', '#32CD32', '#ADFF2F', '#FFFF00', '#FFD700',
        '#FFA500', '#FF8C00', '#FF4500', '#FF0000', '#DC143C',
        '#B22222', '#8B0000', '#800000',
    ];
    const values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

    values.forEach((value, index) => {
        const color = colors[index];
        const legendItem = document.createElement('div');
        legendItem.className = 'map-legend-panel__row';

        const colorBox = document.createElement('span');
        colorBox.className = 'map-legend-panel__swatch';
        colorBox.style.background = color;

        const label = document.createElement('span');
        label.className = 'map-legend-panel__label';
        if (index === 0) {
            label.textContent = '<9°';
        } else if (index === values.length - 1) {
            label.textContent = '>42°';
        } else {
            const nextValue = values[index + 1];
            label.textContent = `${value.toFixed(0)}° - ${nextValue.toFixed(0)}°`;
        }

        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContent.appendChild(legendItem);
    });

    return legendContent;
}
