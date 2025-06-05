import { addCenteredTitle } from './map_utilities_p.js';
import { loadinf_critica } from '../inf_critica_leaflet.js';


// Variables globales para almacenar el estado del mapa, las capas y el título
// Variables globales para almacenar el estado del mapa, las capas y el título
let currentMap = null;
let currentLayer = null;
let mapTitleDiv = null;
let geojsonLayer = null; // Mover la declaración de geojsonLayer al ámbito global
let rasterLayer = null;  // Variable para la capa raster si existe
let infCriticaLayer = null; // Variable para la capa de infraestructura crítica

let currentLayers = {}; // Objeto para almacenar las capas cargadas

export async function map_lum() {
    // Elimina el mapa si ya está inicializado
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        currentLayers = {};  // Restablecer las capas cargadas
    }

    // Crear el mapa
    currentMap = L.map("p46").setView([-33.04752000, -71.44249000], 12.6);

    // Agregar el fondo del mapa
    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);

    // Agregar la escala
    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);

    // Llamar a la función para agregar el título centrado
    addCenteredTitle(currentMap);

    // Inicializar `overlayMaps` antes de usarlo
    const overlayMaps = {};

    // Cargar solo la capa GeoJSON de Luminosidad al inicio
    try {
        const response = await fetch('/assets/vec/capas/Quilpue_Class_Smoothed.geojson');
        const data = await response.json();

        const luminosidadLabels = {
            1: 'Transparente',
            2: 'Baja',
            3: 'Media',
            4: 'Alta'
        };

        geojsonLayer = L.geoJSON(data, {
            style: function (feature) {
                let gridcode = feature.properties.gridcode;
                let fillColor;
                let fillOpacity = 1;

                switch (gridcode) {
                    case 1:
                        fillColor = 'transparent';
                        fillOpacity = 0;
                        break;
                    case 2:
                        fillColor = '#000080';
                        break;
                    case 3:
                        fillColor = 'red';
                        break;
                    case 4:
                        fillColor = 'yellow';
                        break;
                    default:
                        fillColor = 'gray';
                }

                return {
                    color: 'transparent',
                    weight: 0,
                    fillColor: fillColor,
                    fillOpacity: fillOpacity
                };
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties.gridcode !== 1) {
                    layer.on('click', function (e) {
                        const gridcode = feature.properties.gridcode;
                        const luminosidad = luminosidadLabels[gridcode] || 'Desconocida';

                        L.popup()
                            .setLatLng(e.latlng)
                            .setContent(`<strong>Luminosidad:</strong> ${luminosidad}`)
                            .openOn(currentMap);
                    });

                    layer.on('mouseover', function (e) {
                        e.target.setStyle({
                            weight: 2,
                            color: '#666',
                            fillOpacity: e.target.options.fillOpacity
                        });
                        currentMap.getContainer().style.cursor = 'pointer';
                    });

                    layer.on('mouseout', function (e) {
                        geojsonLayer.resetStyle(e.target);
                        currentMap.getContainer().style.cursor = '';
                    });
                }
            }
        }).addTo(currentMap);

        overlayMaps["Luminosidad"] = geojsonLayer;
    } catch (error) {
        console.error('Error al cargar el archivo GeoJSON:', error);
    }

    // No cargar la capa de infraestructura crítica al inicio
    // Si quieres que el usuario pueda activarla manualmente, puedes cargarla aquí pero no agregarla al mapa:
    // const infCriticaLayer = await loadinf_critica(currentMap);
    // if (infCriticaLayer && typeof infCriticaLayer === 'object') {
    //     const layersArray = Object.values(infCriticaLayer);
    //     const infCriticaGroup = L.layerGroup(layersArray);
    //     overlayMaps["Infraestructura Crítica"] = infCriticaGroup;
    // }

    // Crear el control de capas y agregarlo al mapa
    L.control.layers(null, overlayMaps).addTo(currentMap);

    // Llamar a la función para crear el slider de opacidad
    createOpacitySlider();

    // Agregar la leyenda al mapa
    addLegend();



    // Función para crear el slider de opacidad y su funcionalidad
    function createOpacitySlider() {
        // Obtener el contenedor del mapa
        const mapContainer = currentMap.getContainer();
    
        // Crear el contenedor del slider de opacidad
        const opacitySliderContainer = document.createElement('div');
        opacitySliderContainer.id = 'opacity-slider-container';
    
        // Posicionar el slider en el centro derecha
        opacitySliderContainer.style.position = 'absolute';
        opacitySliderContainer.style.top = '50%';
        opacitySliderContainer.style.right = '10px';
        opacitySliderContainer.style.transform = 'translateY(-50%)';
        opacitySliderContainer.style.zIndex = '1000';
        opacitySliderContainer.style.userSelect = 'none';
    
        // Agregar estilos CSS para el slider
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = `
        .opacity-slider {
            width: 52px;
            height: 330px;
            background: #f7f7f7;
            border-radius: 3px;
            text-align: center;
            box-shadow: 0 0 3px 1px rgba(0,0,0,0.2);
            position: relative;
            color: #866a62;
        }
    
        .opacity-slider::before {
            content: "";
            width: 100%;
            height: 1px;
            background: #dedede;
            position: absolute;
            left: 0;
            margin-top: 50px;
            box-shadow:
                0 1px 0 0 white,
                0 230px 0 0 #dedede,
                0 229px 0 0 white;
        }
    
        .buttons span {
            display: block;
            height: 50px;
            cursor: pointer;
            padding-top: 16px;
            font-size: 24px;
            line-height: 18px;
        }
    
        .drag-line {
            width: 8px;
            height: 182px;
            background: #ff9770;
            border-radius: 8px;
            margin: 25px auto;
            position: relative;
        }
    
        .line {
            width: 8px;
            height: 182px;
            background: #adccce;
            border-radius: 8px;
            position: absolute;
            top: 0;
        }
    
        .draggable-button {
            width: 29px;
            height: 29px;
            background: #f7f7f7;
            border-radius: 50%;
            position: absolute;
            box-shadow: 0px 4px 10px 1px rgba(0,0,0,0.2);
            margin-left: -9px;
            cursor: pointer;
            top: 0; /* Inicialmente en la parte superior */
        }
    
        /* Estilos para el indicador de porcentaje */
        .percentage-display {
            position: absolute;
            width: 100%;
            text-align: center;
            top: calc(100% + 10px); /* Ubicarlo justo debajo del dragLine */
            font-size: 14px;
            color: #333;
        }
        `;
        document.head.appendChild(style);
    
        // Crear el slider y sus componentes
        const opacitySlider = document.createElement('div');
        opacitySlider.className = 'opacity-slider';
        opacitySliderContainer.appendChild(opacitySlider);
    
        // Crear el contenedor de los botones
        const buttons = document.createElement('div');
        buttons.className = 'buttons';
        opacitySlider.appendChild(buttons);
    
        // Botón de más
        const plusButton = document.createElement('span');
        plusButton.textContent = '+';
        buttons.appendChild(plusButton);
    
        // Contenedor de la línea y el botón draggable
        const dragLine = document.createElement('div');
        dragLine.className = 'drag-line';
        buttons.appendChild(dragLine);
    
        const line = document.createElement('div');
        line.className = 'line';
        dragLine.appendChild(line);
    
        const draggableButton = document.createElement('div');
        draggableButton.className = 'draggable-button';
        dragLine.appendChild(draggableButton);
    
        // Crear el indicador de porcentaje
        const percentageDisplay = document.createElement('div');
        percentageDisplay.className = 'percentage-display';
        dragLine.appendChild(percentageDisplay);
    
        // Botón de menos
        const minusButton = document.createElement('span');
        minusButton.textContent = '-';
        buttons.appendChild(minusButton);
    
        // Evitar la propagación de eventos al mapa
        opacitySliderContainer.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        opacitySliderContainer.addEventListener('mousemove', (e) => {
            e.stopPropagation();
        });
        opacitySliderContainer.addEventListener('mouseup', (e) => {
            e.stopPropagation();
        });
    
        // Agregar el slider al contenedor del mapa
        mapContainer.appendChild(opacitySliderContainer);
    
        // Variables para el arrastre
        let isDragging = false;
        let startY;
        let startTop;
        const dragMax = 182 - 29; // Altura de la línea menos la altura del botón
    
        // Funciones para manejar el arrastre
        draggableButton.addEventListener('mousedown', function(e) {
            isDragging = true;
            startY = e.clientY;
            startTop = parseInt(draggableButton.style.top || '0', 10);
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        });
    
        function onMouseMove(e) {
            if (!isDragging) return;
            let deltaY = e.clientY - startY;
            let newTop = startTop + deltaY;
            newTop = Math.max(0, Math.min(newTop, dragMax));
            draggableButton.style.top = newTop + 'px';
            updateLine(newTop);
            updateOpacity(newTop);
        }
    
        function onMouseUp() {
            isDragging = false;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }
    
        // Función para actualizar la línea
        function updateLine(position) {
            // La línea debe recortarse desde la posición del botón hacia abajo
            line.style.clip = `rect(${position}px, 8px, 183px, 0px)`;
        }
    
        // Función para actualizar la opacidad y el indicador de porcentaje
        function updateOpacity(position) {
            // Calcular la opacidad basada en la posición del botón
            let opacity = 1 - (position / dragMax);
            // Asegurarse de que la opacidad esté entre 0 y 1
            opacity = Math.max(0, Math.min(opacity, 1));
    
            // Actualizar la opacidad de la capa GeoJSON
            if (geojsonLayer) {
                geojsonLayer.setStyle({ fillOpacity: opacity });
            }
    
            // Actualizar el indicador de porcentaje
            const percentageValue = Math.round(opacity * 100);
            percentageDisplay.textContent = `${percentageValue}%`;
        }
    
        // Eventos para los botones de más y menos
        plusButton.addEventListener('click', function() {
            let currentTop = parseInt(draggableButton.style.top || '0', 10);
            let newTop = currentTop - 14;
            newTop = Math.max(0, newTop);
            draggableButton.style.top = newTop + 'px';
            updateLine(newTop);
            updateOpacity(newTop);
        });
    
        minusButton.addEventListener('click', function() {
            let currentTop = parseInt(draggableButton.style.top || '0', 10);
            let newTop = currentTop + 14;
            newTop = Math.min(newTop, dragMax);
            draggableButton.style.top = newTop + 'px';
            updateLine(newTop);
            updateOpacity(newTop);
        });
    
        // Inicializar la línea y opacidad
        updateLine(0);
        updateOpacity(0);
    }
    

    // Función para agregar la leyenda al mapa
    function addLegend() {
        // Obtener el contenedor del mapa
        const mapContainer = currentMap.getContainer();

        // Crear el contenedor de la leyenda
        const legendContainer = document.createElement('div');
        legendContainer.className = 'info legend';

        // Posicionar la leyenda en el centro izquierda
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
        const legendTitle = document.createElement('div');
        legendTitle.className = 'legend-title';
        legendTitle.style.fontWeight = 'bold';
        legendTitle.style.marginBottom = '5px';
        legendTitle.innerText = 'Luminosidad';
        legendContainer.appendChild(legendTitle);

        // Información de la leyenda
        const categories = [
            { label: 'Alta', color: 'yellow' },
            { label: 'Media', color: 'red' },
            { label: 'Baja', color: '#000080' }
        ];

        categories.forEach(category => {
            const item = document.createElement('div');
            item.className = 'legend-item';
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.marginBottom = '5px';

            const colorBox = document.createElement('div');
            colorBox.className = 'legend-color';
            colorBox.style.width = '18px';
            colorBox.style.height = '18px';
            colorBox.style.marginRight = '8px';
            colorBox.style.opacity = '0.7';
            colorBox.style.backgroundColor = category.color;

            const label = document.createElement('span');
            label.innerText = category.label;

            item.appendChild(colorBox);
            item.appendChild(label);

            legendContainer.appendChild(item);
        });

        // Agregar la leyenda al contenedor del mapa
        mapContainer.appendChild(legendContainer);
    }
}
