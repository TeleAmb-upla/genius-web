// legend_isla.js

export function legend_isla() {
    const legendContent = document.createElement('div');
    legendContent.id = 'yearLegend';
    legendContent.className = 'map-legend-panel';

    const title = document.createElement('div');
    title.textContent = 'Isla de Calor (°C) Anual';
    title.className = 'map-legend-panel__title';
    legendContent.appendChild(title);

    const classes = [
        { label: '0-3°C', color: '#FFFFFF' },
        { label: '3-6°C', color: '#FFCCCC' },
        { label: '6-9°C', color: '#FF6666' },
        { label: '> 9°C', color: '#FF0000' },
    ];

    classes.forEach((cls) => {
        const item = document.createElement('div');
        item.className = 'map-legend-panel__row';

        const colorBox = document.createElement('span');
        colorBox.className = 'map-legend-panel__swatch';
        colorBox.style.backgroundColor = cls.color;
        colorBox.style.borderColor = 'rgba(0, 0, 0, 0.35)';

        const label = document.createElement('span');
        label.className = 'map-legend-panel__label';
        label.textContent = cls.label;

        item.appendChild(colorBox);
        item.appendChild(label);
        legendContent.appendChild(item);
    });

    const container = document.getElementById('p71');
    if (container) {
        container.appendChild(legendContent);
    } else {
        console.error("Elemento con ID 'p71' no encontrado. Asegúrate de que existe en tu HTML.");
    }
}
