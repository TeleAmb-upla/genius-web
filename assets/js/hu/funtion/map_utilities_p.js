// Variable global para almacenar el elemento del título del mapa
let mapTitleDiv = null;

// Función para agregar o actualizar el título centrado al mapa
export function addCenteredTitle(map) {
    if (!mapTitleDiv) {
        // Crear el elemento del título si no existe
        mapTitleDiv = document.createElement('div');
        mapTitleDiv.id = 'map-title';
        mapTitleDiv.style.position = 'absolute';
        mapTitleDiv.style.top = '0%';
        mapTitleDiv.style.left = '50%';
        mapTitleDiv.style.transform = 'translate(-50%, 0)';
        mapTitleDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        mapTitleDiv.style.padding = '10px';
        mapTitleDiv.style.borderRadius = '8px';
        mapTitleDiv.style.zIndex = '1000';
        mapTitleDiv.style.pointerEvents = 'none';
        mapTitleDiv.style.fontFamily = 'Arial';
        mapTitleDiv.style.fontSize = '14px';
        mapTitleDiv.style.fontWeight = 'bold';
        map.getContainer().appendChild(mapTitleDiv);
    }

    // Actualiza el contenido del título
    mapTitleDiv.innerHTML = `Huella Urbana`;
}

// Función para crear la leyenda SVG para los años
export function createLegendSVG() {
    const years = [2023, 2022, 2021, 2020, 2019, 2018];
    
    const colorMapping = {
        2018: '#ffff33', 
        2019: '#ff7f00',  
        2020: '#984ea3', 
        2021: '#4daf4a',
        2022: '#377eb8',
        2023: '#e41a1c'
    };

    const legendItems = years.map((year, index) => {
        const color = colorMapping[year];
        const yPosition = 25 + index * 30;  // Espaciado de 30px entre cada entrada de la leyenda

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${year}</text>
        `;
    }).join('');

    return `
        <svg width="100" height="200" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial">Huella Urbana</text>
            ${legendItems}
        </svg>
    `;
}
