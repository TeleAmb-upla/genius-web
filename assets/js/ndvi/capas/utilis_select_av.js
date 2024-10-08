// colores
function valueToDevColor(value) {
  
    const domain = [0, 0.22]; // mínimo y máximo
    // Paleta de colores invertida que representa los diferentes valores de NDVI
    const range = ["#008000", "#a19b00", "#da9b00", "#ff8b00", "#ff5f00", "#ff0000"];
    
    // Calcular el paso entre cada color en función del dominio
    const step = (domain[1] - domain[0]) / (range.length - 1);
    
    // Asignar los colores basado en el valor
    if (value < domain[0]) {
        return range[0]; // Si es menor que el mínimo, devolver el primer color
    } 
    if (value > domain[1]) {
        return range[range.length - 1]; // Si es mayor que el máximo, devolver el último color
    }
    
    // Encontrar el color adecuado dentro del rango
    const index = Math.floor((value - domain[0]) / step);
    return range[index];
    }
    
// Mapa de nombres de categorías a nombres amigables
const categoryNames = {
    "AV_ComunalesPúblicas_EsteroQuilpué": "Comunales Públicas Estero Quilpué",
    "AV_ComunalesPúblicas_Quebradas": "Comunales Públicas Quebradas",
    "AV_ComunalesPrivadas_Agrestes": "Comunales Privadas Agrestes",
    "AV_Consolidadas": "Consolidadas",
    "AV_IntComunalesPrivadas_Agrestes": "Intercomunales Privadas Agrestes",
    "AV_IntComunalesPrivadas_Recreativas": "Intercomunales Privadas Recreativas",
    "AV_IntComunalesPrivadas_ResguardoPatrimonial": "Intercomunales Privadas Resguardo Patrimonial",
    "AV_IntComunalesPúblicas_ParqueIntercomunal": "Intercomunales Públicas Parque Intercomunal",
    "AV_ParqueUrbano": "Parque Urbano",
    "Mantencion_General": "Mantención General"
};


// Mapa de nombres de categorías a nombres amigables (lo mantienes como está)

// Función para cargar datos GeoJSON y configurar capas
export async function loadGeoJSONAndSetupLayers(currentMap) {
    try {
        const response = await fetch('/assets/vec/capas/NDVI_SD_ZonalStats_2022_2024.geojson');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
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
                    const ndvi_sd = feature.properties.NDVI_SD;
                    return {
                        color: '#000000',   // Color del borde
                        weight: 1,          // Grosor del borde
                        opacity: 1,         // Opacidad del borde
                        fillColor: valueToDevColor(ndvi_sd), // Color de relleno basado en NDVI_SD
                        fillOpacity: 100    // Opacidad del relleno
                    };
                },
                onEachFeature: function (feature, layer) {
                    // Crear un tooltip para cada polígono
                    layer.on('mouseover', function (e) {
                        const properties = feature.properties;
                        const area = properties.AREA ? parseFloat(properties.AREA).toFixed(2) : 'No disponible';
                        const ndvi_sd = properties.NDVI_SD ? parseFloat(properties.NDVI_SD).toFixed(3) : 'No disponible';

                        const tooltipContent = `
                            <strong>Categoría:</strong> ${categoryNames[properties.CATEGORIA] || properties.CATEGORIA}<br>
                            <strong>Área:</strong> ${area} m²<br>
                            <strong>Desviación Estándar :</strong> ${ndvi_sd}
                        `;
                        layer.bindTooltip(tooltipContent).openTooltip(e.latlng);
                    });

                    layer.on('mouseout', function () {
                        layer.closeTooltip(); // Cerrar el tooltip cuando el mouse sale del polígono
                    });
                }
            });

            // Añadir la capa al mapa
            categoryLayers[layerName].addTo(currentMap);
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
    mainContainer.id = id;
    mainContainer.style.position = 'absolute';
    mainContainer.style.zIndex = '1000';
    // Las posiciones específicas se manejarán en positionAvSelector

    // Cuadro de texto inicial que funciona como el activador
    const toggleBox = document.createElement('div');
    toggleBox.innerText = 'Categorias de Áreas Verdes';
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

    // Mostrar el contenedor de opciones al hacer clic en el cuadro de texto
    toggleBox.addEventListener('click', () => {
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
    });

    // Ocultar las opciones cuando se hace clic fuera del contenedor
    document.addEventListener('click', (e) => {
        if (!mainContainer.contains(e.target)) {
            container.style.display = 'none';
        }
    });

    // Agregar el cuadro de texto y el contenedor de opciones al contenedor principal
    mainContainer.appendChild(toggleBox);
    mainContainer.appendChild(container);

    // Añadir el contenedor principal al mapa
    currentMap.getContainer().appendChild(mainContainer);

    return mainContainer; // Devolver el contenedor principal que incluye el toggle y las opciones
}

// Función para posicionar el selector en la parte superior derecha
export function positionAvSelector(container, position) {
    // La posición se pasa como string, por ejemplo, 'top-right'
    if (position === 'top-left') {
        container.style.top = '10px';
        container.style.left = '10px';
    } else if (position === 'top-right') {
        container.style.top = '10px';
        container.style.right = '10px';
    } else if (position === 'bottom-left') {
        container.style.bottom = '10px';
        container.style.left = '10px';
    } else if (position === 'bottom-right') {
        container.style.bottom = '10px';
        container.style.right = '10px';
    }

    // Asegúrate de que el contenedor esté dentro del mapa
    const mapElement = document.getElementById('p67');
    if (mapElement) {
        mapElement.appendChild(container); // Asegurarse de agregar el contenedor (que incluye el selector) al mapa
    }
}
