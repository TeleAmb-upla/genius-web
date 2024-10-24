// colores
function valueToDevColor(value) {
    const domain = [0, 0.22]; // mínimo y máximo
    // Paleta de colores invertida que representa los diferentes valores de NDVI
    const range = ["#B9B0B9","#C7979E","#D57E83","#E36468","#F14B4D","#FF3232"]
   
    
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
    "AV_Consolidadas": "Areas Verdes Consolidadas",
    "AV_IntComunalesPrivadas_Agrestes": "Intercomunales Privadas Agrestes",
    "AV_IntComunalesPrivadas_Recreativas": "Intercomunales Privadas Recreativas",
    "AV_IntComunalesPrivadas_ResguardoPatrimonial": "Intercomunales Privadas Resguardo Patrimonial",
    "AV_IntComunalesPúblicas_ParqueIntercomunal": "Intercomunales Públicas Parque Intercomunal",
    "AV_ParqueUrbano": "Parque Urbano",
    "Mantencion_General": "Mantención General"
};

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
                        fillOpacity: 0.6    // Opacidad del relleno
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

    // Cuadro de texto inicial que funciona como el activador
    const toggleBox = document.createElement('div');
    toggleBox.innerText = 'Categorías de Áreas Verdes';
    toggleBox.style.cursor = 'pointer';
    toggleBox.style.backgroundColor = '#fff';
    toggleBox.style.padding = '8px';
    toggleBox.style.borderRadius = '5px';
    toggleBox.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
    toggleBox.style.border = '1px solid #ccc';
    toggleBox.style.display = 'inline-block';
    toggleBox.style.marginBottom = '5px';

    // Contenedor para los tres grupos (inicialmente oculto)
    const groupContainer = document.createElement('div');
    groupContainer.style.backgroundColor = 'white';
    groupContainer.style.padding = '8px';
    groupContainer.style.borderRadius = '5px';
    groupContainer.style.boxShadow = '0 0 15px rgba(0,0,0,0.2)';
    groupContainer.style.border = '1px solid #ccc';
    groupContainer.style.display = 'none';  // Inicialmente oculto
    groupContainer.style.marginTop = '5px';
    groupContainer.style.position = 'relative';

    // Orden de categorías y sus grupos
    const categoryGroups = [
        {
            title: "Plan Regulador Comunal",
            categories: [
                "AV_ComunalesPúblicas_EsteroQuilpué",
                "AV_ComunalesPúblicas_Quebradas",
                "AV_ComunalesPrivadas_Agrestes",
                "AV_Consolidadas",
                "AV_IntComunalesPrivadas_Agrestes",
                "AV_IntComunalesPrivadas_Recreativas",
                "AV_IntComunalesPrivadas_ResguardoPatrimonial",
                "AV_IntComunalesPúblicas_ParqueIntercomunal"
            ]
        },
        {
            title: "MINVU",
            categories: [
                "AV_ParqueUrbano"
            ]
        },
        {
            title: "Municipalidad Quilpué",
            categories: [
                "Mantencion_General"
            ]
        }
    ];

    // Crear toggleBox para cada grupo
    categoryGroups.forEach(group => {
        const groupToggleBox = document.createElement('div');
        groupToggleBox.innerText = group.title;
        groupToggleBox.style.cursor = 'pointer';
groupToggleBox.addEventListener('mouseover', () => {
    groupToggleBox.style.border = '1px solid #bbb';
});
groupToggleBox.addEventListener('mouseout', () => {
    if (groupOptionsContainer.style.display === 'none') {
        groupToggleBox.style.border = '1px solid transparent';
    }
});
        groupToggleBox.style.backgroundColor = '#f0f0f0';
        groupToggleBox.style.padding = '6px';
        groupToggleBox.style.borderRadius = '3px';
        groupToggleBox.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
        groupToggleBox.style.border = '1px solid transparent';
        groupToggleBox.style.display = 'inline-block';
        groupToggleBox.style.marginBottom = '5px';
        groupToggleBox.style.marginTop = '5px';

        // Contenedor para las opciones de cada grupo (inicialmente oculto)
        const groupOptionsContainer = document.createElement('div');
        groupOptionsContainer.style.backgroundColor = 'white';
        groupOptionsContainer.style.padding = '6px';
        groupOptionsContainer.style.borderRadius = '3px';
        groupOptionsContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.1)';
        groupOptionsContainer.style.border = '1px solid #bbb';
        groupOptionsContainer.style.display = 'none';
        groupOptionsContainer.style.marginTop = '5px';

        // Crear checkboxes para cada categoría en el grupo
        group.categories.forEach(categoryKey => {
            if (categoryLayers[categoryNames[categoryKey]]) {
                const layerName = categoryNames[categoryKey] || categoryKey;
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
                groupOptionsContainer.appendChild(checkboxContainer);

                // Manejar la selección de capas
                checkbox.addEventListener('change', () => {
                    if (checkbox.checked) {
                        currentMap.addLayer(categoryLayers[layerName]); // Agregar capa al mapa
                    } else {
                        currentMap.removeLayer(categoryLayers[layerName]); // Quitar capa del mapa
                    }
                });
            }
        });

        // Mostrar/ocultar las opciones del grupo al hacer clic en el toggle
        groupToggleBox.addEventListener('mouseover', () => {
            groupToggleBox.style.border = '1px solid transparent';
        });
        groupToggleBox.addEventListener('mouseout', () => {
            groupToggleBox.style.border = '1px solid transparent';
        });
        groupToggleBox.addEventListener('click', () => {
    groupToggleBox.style.border = '1px solid #bbb';
            groupOptionsContainer.style.display = groupOptionsContainer.style.display === 'none' ? 'block' : 'none';
        });

        groupContainer.appendChild(groupToggleBox);
        groupContainer.appendChild(groupOptionsContainer);
    });

    // Mostrar el contenedor de grupos al hacer clic en el cuadro de texto principal
    toggleBox.addEventListener('click', () => {
        groupContainer.style.display = groupContainer.style.display === 'none' ? 'block' : 'none';
    });

    // Ocultar las opciones cuando se hace clic fuera del contenedor
    document.addEventListener('click', (e) => {
        if (!mainContainer.contains(e.target)) {
            groupContainer.style.display = 'none';
        }
    });

    // Agregar el cuadro de texto y el contenedor de grupos al contenedor principal
    mainContainer.appendChild(toggleBox);
    mainContainer.appendChild(groupContainer);

    // Añadir el contenedor principal al mapa
    currentMap.getContainer().appendChild(mainContainer);

    return mainContainer; // Devolver el contenedor principal que incluye el toggle y las opciones
}

export function positionAvSelector(container, position, offsetX = 0, offsetY = 0) {
    // La posición se pasa como string, por ejemplo, 'top-right'
    if (position === 'top-left') {
        container.style.top = (10 + offsetY) + 'px';
        container.style.left = (10 + offsetX) + 'px';
    } else if (position === 'top-right') {
        container.style.top = (10 + offsetY) + 'px';
        container.style.right = (10 + offsetX) + 'px';
    } else if (position === 'bottom-left') {
        container.style.bottom = (10 + offsetY) + 'px';
        container.style.left = (10 + offsetX) + 'px';
    } else if (position === 'bottom-right') {
        container.style.bottom = (10 + offsetY) + 'px';
        container.style.right = (10 + offsetX) + 'px';
    }

    // Asegúrate de que el contenedor esté dentro del mapa
    const mapElement = document.getElementById('p67');
    if (mapElement) {
        mapElement.appendChild(container); // Asegurar que el contenedor esté en el mapa
    }
}


