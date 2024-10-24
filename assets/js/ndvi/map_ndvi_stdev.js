// Importar funciones desde otros módulos
import { loadGeoJSONAndSetupLayers, createAvSelector, positionAvSelector } from './capas/utilis_select_av.js';
import { map_stdev, createDevLegendSVG } from './ndvi_trend_dev/stddev.js'; // Ajusta la ruta según tu estructura de carpetas

// Variables globales para almacenar el estado del mapa y las capas
let currentMap = null;
let legendDiv = null; // Variable global para la leyenda
let stdevGeoraster = null; // Variable para almacenar el georaster
let rasterLayer = null; // Variable para la capa raster de desviación estándar
let avSelector = null; // Variable para el selector de áreas verdes
let categoryLayers = {}; // Variable para almacenar capas GeoJSON

export async function map_ndvi_stdev() {
    // Si el mapa ya existe, remuévelo y limpia las variables
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        legendDiv = null;
        stdevGeoraster = null;
        rasterLayer = null;
        avSelector = null;
        categoryLayers = {};

        // Eliminar el título del mapa si existe
        let mapTitleDiv = document.getElementById('map-title');
        if (mapTitleDiv) {
            mapTitleDiv.remove();
        }

        // Eliminar la leyenda si existe
        if (legendDiv) {
            legendDiv.remove();
            legendDiv = null;
        }
    }

    // Inicializar el mapa
    currentMap = L.map("p67").setView([-33.04752000, -71.44249000], 12.6);

    // Capa base de CartoDB
    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(currentMap);

    // Agregar escala métrica en la esquina inferior izquierda
    L.control.scale({
        position: 'bottomleft', // Posición deseada
        metric: true,
        imperial: false
    }).addTo(currentMap);

    // Cargar y configurar las capas GeoJSON
    categoryLayers = await loadGeoJSONAndSetupLayers(currentMap);

    // Crear el selector de capas de áreas verdes
    avSelector = createAvSelector('av-selector', categoryLayers, currentMap);

    // Posicionar el selector en la parte superior derecha con desplazamiento
    positionAvSelector(avSelector, 'top-right', 200, 0); // Desplazar 20px a la derecha

    // **Ajustar el z-index del avSelector para que esté por encima del slider**
    const avSelectorContainer = document.getElementById('av-selector');
    if (avSelectorContainer) {
        avSelectorContainer.style.zIndex = '1100'; // Asegura que esté por encima del slider
    }

    // Convertir categoryLayers a un array de capas
    const categoryLayersArray = Object.values(categoryLayers);

    // Cargar y agregar la capa raster de desviación estándar
    const rasterData = await map_stdev(currentMap);
    stdevGeoraster = rasterData.georaster; // Guardar el georaster
    rasterLayer = rasterData.layer;
    rasterLayer.addTo(currentMap);

    // Crear un control de capas y añadir la capa raster como overlay
    const overlayMaps = {
        "Desviación Estándar": rasterLayer
    };
    L.control.layers(null, overlayMaps, { position: 'topright' }).addTo(currentMap);

    // Crear y agregar la leyenda del raster en centro-izquierda (siempre visible)
    addCustomLegend(currentMap, createDevLegendSVG());

    // Añadir evento de clic para mostrar el valor del raster
    currentMap.on('click', function(event) {
        const latlng = event.latlng;
        let valueArray = geoblaze.identify(stdevGeoraster, [latlng.lng, latlng.lat]);
        let value = (valueArray && valueArray.length > 0) ? valueArray[0] : null;

        value = (value !== null && !isNaN(value)) ? value.toFixed(2) : 'No disponible';

        const content = `
            <div style="text-align:center; padding:2px; background-color:#fff; font-size:10px; max-width:120px;">
                Desviación Estándar: ${value}
            </div>
        `;

        L.popup({ className: 'custom-popup' })
            .setLatLng(latlng)
            .setContent(content)
            .openOn(currentMap);
    });

    // Implementación del slider de opacidad único
    createOpacitySlider(currentMap, rasterLayer, categoryLayersArray);
}

// Función para crear y posicionar una leyenda personalizada en centro-izquierda
function addCustomLegend(map, legendHTML) {
    // Crear un div para la leyenda
    legendDiv = L.DomUtil.create('div', 'custom-legend');
    legendDiv.innerHTML = legendHTML;

    // Añadir el div al contenedor del mapa
    map.getContainer().appendChild(legendDiv);

    // Aplicar estilos CSS para posicionar la leyenda en centro-izquierda (siempre visible)
    Object.assign(legendDiv.style, {
        position: 'absolute',
        top: '50%', // Centrar verticalmente
        left: '10px', // A 10px del borde izquierdo
        transform: 'translateY(-50%)', // Ajustar para centrar verticalmente
        background: 'rgba(255, 255, 255, 0.8)',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 0 15px rgba(0,0,0,0.2)',
        zIndex: '1000'
    });
}

// Función para crear el slider de opacidad único
function createOpacitySlider(map, rasterLayer, categoryLayersArray) {
    // Crear el contenedor principal del slider y agregarlo al mapa
    const wrapper = L.DomUtil.create('div', 'wrapper');
    map.getContainer().appendChild(wrapper);

    // Crear el contenedor del slider
    const mapSlider = L.DomUtil.create('div', 'map-slider', wrapper);

    // Crear el contenedor de los botones
    const buttons = L.DomUtil.create('div', 'buttons', mapSlider);

    // Botón de más
    const plusButton = L.DomUtil.create('span', '', buttons);
    plusButton.textContent = '+';

    // Contenedor de la línea y el botón draggable
    const dragLine = L.DomUtil.create('div', 'drag-line', buttons);
    const line = L.DomUtil.create('div', 'line', dragLine);
    const draggableButton = L.DomUtil.create('div', 'draggable-button', dragLine);

    // Crear el indicador de porcentaje
    const percentageDisplay = L.DomUtil.create('div', 'percentage-display', dragLine);

    // Botón de menos
    const minusButton = L.DomUtil.create('span', '', buttons);
    minusButton.textContent = '-';

    // Evitar que los eventos del slider se propaguen al mapa
    L.DomEvent.disableClickPropagation(wrapper);

    // Agregar los estilos CSS al documento desde JavaScript
    const style = document.createElement('style');
    style.type = 'text/css';
    const css = `
      /* Estilos generales */
      .wrapper {
        width: 52px;
        position: absolute;
        top: 50%;
        right: 20px;
        transform: translateY(-50%);
        z-index: 1000; /* Reducir z-index para que el avSelector esté por encima */
        user-select: none;
      }

      .map-slider {
        width: 52px;
        height: 330px;
        background: #f7f7f7;
        border-radius: 3px;
        text-align: center;
        box-shadow: 0 0 3px 1px rgba(0,0,0,0.2);
        position: relative;
        color: #866a62;
      }

      .map-slider::before {
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
    if (style.styleSheet) {
        style.styleSheet.cssText = css;
    } else {
        style.appendChild(document.createTextNode(css));
    }
    document.head.appendChild(style);

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
        let clipValue = position + 'px, 8px, 183px, 0px';
        line.style.clip = 'rect(' + clipValue + ')';
    }

    // Función para actualizar la opacidad y el indicador de porcentaje
    function updateOpacity(position) {
        // Calcular la opacidad basada en la posición del botón
        let opacity = 1 - (position / dragMax);
        // Asegurarse de que la opacidad esté entre 0 y 1
        opacity = Math.max(0, Math.min(opacity, 1));

        // Ajustar la opacidad de la capa raster usando setOpacity
        if (rasterLayer) {
            rasterLayer.setOpacity(opacity);
        }

        // Ajustar la opacidad de las capas GeoJSON
        if (categoryLayersArray && categoryLayersArray.length > 0) {
            categoryLayersArray.forEach(layer => {
                layer.setStyle({ opacity: opacity, fillOpacity: opacity });
            });
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
