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
        const response = await fetch(
            resolveAssetUrl('assets/data/geojson/NDVI/NDVI_SD_ZonalStats/NDVI_SD_ZonalStats_av.geojson')
        );
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

const CATEGORY_SWATCH_COLORS = {
    "AV_ComunalesPúblicas_EsteroQuilpué":              "#4a90d9",
    "AV_ComunalesPúblicas_Quebradas":                  "#6aaa64",
    "AV_ComunalesPrivadas_Agrestes":                   "#8bc34a",
    "AV_Consolidadas":                                 "#2e7d32",
    "AV_IntComunalesPrivadas_Agrestes":                "#cddc39",
    "AV_IntComunalesPrivadas_Recreativas":             "#ffeb3b",
    "AV_IntComunalesPrivadas_ResguardoPatrimonial":    "#ff9800",
    "AV_IntComunalesPúblicas_ParqueIntercomunal":      "#00bcd4",
    "AV_ParqueUrbano":                                 "#9c27b0",
    "Mantencion_General":                              "#795548",
};

export function createAvSelector(id, categoryLayers, currentMap) {
    const mainContainer = document.createElement('div');
    mainContainer.id = id;
    mainContainer.className = 'av-selector-panel';

    const header = document.createElement('div');
    header.className = 'av-selector-panel__header';
    header.innerHTML = '<span>&#9660;</span> Categorías de Áreas Verdes';

    const body = document.createElement('div');
    body.className = 'av-selector-panel__body';
    body.style.display = 'none';

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
            categories: ["AV_ParqueUrbano"]
        },
        {
            title: "Municipalidad Quilpué",
            categories: ["Mantencion_General"]
        }
    ];

    categoryGroups.forEach(group => {
        const groupTitle = document.createElement('div');
        groupTitle.className = 'av-selector-panel__group-title';
        groupTitle.textContent = group.title;
        body.appendChild(groupTitle);

        group.categories.forEach(categoryKey => {
            const layerName = categoryNames[categoryKey] || categoryKey;
            if (!categoryLayers[layerName]) return;

            const row = document.createElement('label');
            row.className = 'av-selector-panel__item';

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = layerName;

            const swatch = document.createElement('span');
            swatch.className = 'av-selector-panel__swatch';
            swatch.style.backgroundColor = CATEGORY_SWATCH_COLORS[categoryKey] || '#94a3b8';

            const labelText = document.createElement('span');
            labelText.textContent = layerName;

            row.appendChild(checkbox);
            row.appendChild(swatch);
            row.appendChild(labelText);
            body.appendChild(row);

            checkbox.addEventListener('change', () => {
                if (checkbox.checked) {
                    currentMap.addLayer(categoryLayers[layerName]);
                } else {
                    currentMap.removeLayer(categoryLayers[layerName]);
                }
            });
        });
    });

    header.addEventListener('click', () => {
        const isOpen = body.style.display !== 'none';
        body.style.display = isOpen ? 'none' : 'block';
        header.querySelector('span').textContent = isOpen ? '\u25BC' : '\u25B2';
    });

    document.addEventListener('click', (e) => {
        if (!mainContainer.contains(e.target)) {
            body.style.display = 'none';
            header.querySelector('span').textContent = '\u25BC';
        }
    });

    mainContainer.appendChild(header);
    mainContainer.appendChild(body);
    currentMap.getContainer().appendChild(mainContainer);

    return mainContainer;
}

export function positionAvSelector(container, position, offsetX = 0, offsetY = 0) {
    if (position === 'top-center') {
        container.style.top = (10 + offsetY) + 'px';
        container.style.left = '50%';
        container.style.transform = 'translateX(-50%)';
    } else if (position === 'top-left') {
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

    const mapElement = document.getElementById('p67');
    if (mapElement) {
        mapElement.appendChild(container);
    }
}


