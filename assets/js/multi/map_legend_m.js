import * as d3 from 'https://cdn.skypack.dev/d3@7';


export function addLegend_noche(map) {
    // Eliminar leyenda previa si existe
    removeLegend(map);

    // Crear contenedor de la leyenda
    const legendContainer = document.createElement('div');
    legendContainer.className = 'info legend';
    legendContainer.style.position = 'absolute';
    legendContainer.style.top = '50%';
    legendContainer.style.left = '10px';
    legendContainer.style.transform = 'translateY(-50%)';
    legendContainer.style.backgroundColor = 'white';
    legendContainer.style.padding = '10px';
    legendContainer.style.borderRadius = '5px';
    legendContainer.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.2)';
    legendContainer.style.fontSize = '14px';
    legendContainer.style.lineHeight = '18px';
    legendContainer.style.color = '#333';
    legendContainer.style.zIndex = '1000';

    // Título de la leyenda
    const title = document.createElement('div');
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '5px';
    title.innerText = 'Luminosidad';
    legendContainer.appendChild(title);

    // Elementos de la leyenda
    const categories = [
        { label: '(4) Alta', color: 'yellow' },
        { label: '(3) Media', color: 'red' },
        { label: '(2) Baja', color: '#000080' }
    ];

    categories.forEach(category => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.marginBottom = '5px';

        const colorBox = document.createElement('div');
        colorBox.style.width = '18px';
        colorBox.style.height = '18px';
        colorBox.style.backgroundColor = category.color;
        colorBox.style.marginRight = '8px';
        item.appendChild(colorBox);

        const label = document.createElement('span');
        label.innerText = category.label;
        item.appendChild(label);

        legendContainer.appendChild(item);
    });

    // Agregar leyenda al contenedor del mapa
    map.getContainer().appendChild(legendContainer);
    map.legendDiv = legendContainer;
}

export function addLegend_temp(map) {
    // Eliminar leyenda previa si existe
    removeLegend(map);

    // Crear leyenda SVG
    const legendContainer = document.createElement('div');
    legendContainer.className = 'info legend';
    legendContainer.style.position = 'absolute';
    legendContainer.style.top = '50%';
    legendContainer.style.left = '10px';
    legendContainer.style.transform = 'translateY(-50%)';
    legendContainer.style.backgroundColor = 'white';
    legendContainer.style.padding = '10px';
    legendContainer.style.borderRadius = '5px';
    legendContainer.style.boxShadow = '0 0 15px rgba(0, 0, 0, 0.2)';
    legendContainer.style.fontSize = '14px';
    legendContainer.style.lineHeight = '18px';
    legendContainer.style.color = '#333';
    legendContainer.style.zIndex = '1000';

    const domain = [0, 39];
    const steps = 18;
    const colorsBase = ["#00008B", "#00BFFF", "#32CD32", "#FFFF00", "#FFA500", "#FF4500"];
    const colorScale = d3.scaleSequential()
        .domain([0, steps - 1])
        .interpolator(d3.interpolateRgbBasis(colorsBase));
    const extendedColors = d3.range(steps).map(i => colorScale(i));

    const legendItems = extendedColors.map((color, index) => `
        <div style="display: flex; align-items: center; margin-bottom: 5px;">
            <div style="width: 18px; height: 18px; background-color: ${color}; margin-right: 8px;"></div>
            <span>${Math.round(domain[0] + index * (domain[1] - domain[0]) / steps)}°C</span>
        </div>
    `).join('');

    legendContainer.innerHTML = `
        <div style="font-weight: bold; margin-bottom: 5px;">Temperatura</div>
        ${legendItems}
    `;

    // Agregar leyenda al contenedor del mapa
    map.getContainer().appendChild(legendContainer);
    map.legendDiv = legendContainer;
}

export function removeLegend(map) {
    if (map.legendDiv) {
        map.legendDiv.remove();
        map.legendDiv = null;
    }
}