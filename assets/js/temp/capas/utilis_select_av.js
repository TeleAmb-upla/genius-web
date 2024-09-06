// Mapa de nombres de categorías a nombres amigables
const categoryNames = {
    "AV_ComunalesPublicas_EsteroQuilpue": "Av. Comunales Publicas Estero Quilpue",
    "AV_ComunalesPublicas_Quebradas": "Av. Comunales Publicas Quebradas",
    "AV_Consolidadas": "Consolidadas",
    "AV_IntComunalesPrivadas_Agrestes": "Av. InterComunales Privadas Agrestes",
    "AV_IntComunalesPrivadas_Recreativas": "Av. InterComunales Privadas Recreativas",
    "AV_IntComunalesPrivadas_ResguardoPatrimonial": "Av. InterComunales Privadas Resguardo Patrimonial",
    "AV_IntComunalesPublicas_ParqueIntercomunal": "AV. IntComunales Publicas Parque Intercomunal",
    "Av_ComunalesPrivadas_Agrestes": "Av. Comunales Privadas Agrestes",
    "Av_ParqueUrbano": "Av Parque Urbano",
    "Mantencion_General": "Mantencion General"
};

// Función para cargar datos GeoJSON y configurar capas
export async function loadGeoJSONAndSetupLayers(currentMap) {
    try {
        const response = await fetch('/assets/vec/capas/Areas_Verdes_Oficial.geojson');
        const data = await response.json();

        // Ajustar los límites del mapa según los datos cargados
        currentMap.fitBounds(L.geoJSON(data).getBounds());

        // Obtener categorías únicas
        const categories = new Set();
        data.features.forEach(feature => {
            if (feature.properties.CATEGORIA) {
                categories.add(feature.properties.CATEGORIA);
            }
        });

        // Crear un objeto para almacenar las capas
        const categoryLayers = {};

        // Crear una capa para cada categoría
        categories.forEach(category => {
            const layerName = categoryNames[category] || category;  
            categoryLayers[layerName] = L.geoJSON(data, {
                filter: feature => feature.properties.CATEGORIA === category,
                style: function (feature) {
                    return {
                        color: '#000000',   // Color del borde
                        weight: 1,          // Grosor del borde
                        opacity: 1,         // Opacidad del borde
                        fillColor: '#ffffff', // Color de relleno
                        fillOpacity: 0.3    // Opacidad del relleno
                    };
                },
                onEachFeature: function (feature, layer) {
                    // Crear un tooltip para cada polígono
                    layer.on('mouseover', function (e) {
                        const properties = feature.properties;
                        const area = properties.AREA ? parseFloat(properties.AREA).toFixed(2) : 'No disponible';
                        const tooltipContent = `
                            <strong>Categoría:</strong> ${categoryNames[properties.CATEGORIA] || properties.CATEGORIA}<br>
                            <strong>Área:</strong> ${area} m²
                        `;
                        layer.bindTooltip(tooltipContent).openTooltip(e.latlng);
                    });

                    layer.on('mouseout', function () {
                        layer.closeTooltip(); // Cerrar el tooltip cuando el mouse sale del polígono
                    });
                }
            });
        });

        // Devolver las capas para usarlas más tarde
        return categoryLayers;

    } catch (error) {
        console.error("Error al cargar el GeoJSON:", error);
    }
}


// Función para crear y posicionar el selector de capas de áreas verdes
export function createAvSelector(id, categoryLayers, currentMap) {
    // Contenedor principal para el cuadro de texto de activación y opciones
    const mainContainer = document.createElement('div');
    mainContainer.style.position = 'absolute';
    mainContainer.style.zIndex = '1000';
    mainContainer.style.top = '70px';
    mainContainer.style.left = '10px';
    mainContainer.style.fontFamily = 'Arial, sans-serif';

    // Cuadro de texto inicial que funciona como el activador
    const toggleBox = document.createElement('div');
    toggleBox.innerText = 'Capas de Áreas Verdes';
    toggleBox.style.cursor = 'pointer';
    toggleBox.style.backgroundColor = '#fff';
    toggleBox.style.padding = '8px';
    toggleBox.style.borderRadius = '5px';
    toggleBox.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
    toggleBox.style.border = '1px solid #ccc';
    toggleBox.style.display = 'inline-block';
    toggleBox.style.marginBottom = '5px';

    // Contenedor para las opciones de capas (inicialmente oculto)
    const container = document.createElement('div');
    container.style.backgroundColor = 'white';
    container.style.padding = '8px';
    container.style.borderRadius = '5px';
    container.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
    container.style.border = '1px solid #ccc';
    container.style.display = 'none';  // Inicialmente oculto
    container.style.marginTop = '5px';
    container.style.position = 'relative';

    // Agregar checkbox para "Limpiar capas" primero
    const clearContainer = document.createElement('div');
    clearContainer.style.display = 'flex';
    clearContainer.style.alignItems = 'center';
    clearContainer.style.marginBottom = '10px';

    const clearCheckbox = document.createElement('input');
    clearCheckbox.type = 'checkbox';
    clearCheckbox.id = `${id}-clear`;
    clearCheckbox.style.marginRight = '8px';

    const clearLabel = document.createElement('label');
    clearLabel.htmlFor = clearCheckbox.id;
    clearLabel.innerText = 'Limpiar capas';
    clearLabel.style.fontFamily = 'Arial, sans-serif';

    clearContainer.appendChild(clearCheckbox);
    clearContainer.appendChild(clearLabel);
    container.appendChild(clearContainer);

    // Manejar la opción "Limpiar capas"
    clearCheckbox.addEventListener('change', () => {
        if (clearCheckbox.checked) {
            // Desmarcar todos los checkboxes y quitar todas las capas
            Object.keys(categoryLayers).forEach(layerName => {
                const checkbox = document.getElementById(`${id}-${layerName}`);
                if (checkbox) checkbox.checked = false;
                currentMap.removeLayer(categoryLayers[layerName]);
            });
            clearCheckbox.checked = false; // Desmarcar el checkbox de "Limpiar capas"
        }
    });

    // Crear checkboxes para cada capa de categoría
    Object.keys(categoryLayers).forEach(layerName => {
        const checkboxContainer = document.createElement('div');
        checkboxContainer.style.display = 'flex';
        checkboxContainer.style.alignItems = 'center';
        checkboxContainer.style.marginBottom = '5px';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.id = `${id}-${layerName}`;
        checkbox.value = layerName;
        checkbox.style.marginRight = '8px';

        const checkboxLabel = document.createElement('label');
        checkboxLabel.htmlFor = checkbox.id;
        checkboxLabel.innerText = layerName;
        checkboxLabel.style.fontFamily = 'Arial, sans-serif';

        checkboxContainer.appendChild(checkbox);
        checkboxContainer.appendChild(checkboxLabel);
        container.appendChild(checkboxContainer);

        // Inicialmente, todas las capas están desactivadas
        currentMap.removeLayer(categoryLayers[layerName]);

        // Manejar la selección de capas
        checkbox.addEventListener('change', () => {
            if (checkbox.checked) {
                currentMap.addLayer(categoryLayers[layerName]); // Agregar capa al mapa
            } else {
                currentMap.removeLayer(categoryLayers[layerName]); // Quitar capa del mapa
            }
        });
    });

    // Mostrar el contenedor de opciones al pasar el mouse sobre el cuadro de texto
    toggleBox.addEventListener('mouseover', () => {
        container.style.display = 'block';
    });

    // Mantener las opciones visibles mientras el mouse esté dentro del contenedor
    container.addEventListener('mouseover', () => {
        container.style.display = 'block';
    });

    // Ocultar las opciones cuando el mouse salga del contenedor
    container.addEventListener('mouseleave', () => {
        container.style.display = 'none';
    });

    // Agregar el cuadro de texto y el contenedor de opciones al contenedor principal
    mainContainer.appendChild(toggleBox);
    mainContainer.appendChild(container);
    
    // Añadir el contenedor principal al mapa
    currentMap.getContainer().appendChild(mainContainer);

    return mainContainer; // Devolver el contenedor principal que incluye el toggle y las opciones
}

// Función para posicionar el selector en la parte superior
export function positionAvSelector(container, position) {
    const mapElement = document.getElementById('p10');
    
    if (position === 'top') {
        container.style.top = '10px';
        container.style.left = '50px';
    } else if (position === 'left') {
        container.style.bottom = '10px';
        container.style.left = '50px';
    } else if (position === 'right') {
        container.style.bottom = '10px';
        container.style.right = '50px';
    }

    mapElement.appendChild(container); // Asegúrate de agregar el contenedor (que incluye el selector) al mapa
}
