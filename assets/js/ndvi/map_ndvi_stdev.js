// -----------------------------------------------------------------------------
// Opacidad raster + capas categoría: panel horizontal compartido (slider_opacity.js / main.css).
//
// 2. createyearLegendSVG y createmonthLegendSVG: Leyendas SVG adaptativas
//    - Versión responsive: Ambas funciones aceptan un parámetro isMobile para renderizar versión compacta en móvil y extendida en escritorio.
//    - Tamaños y fuentes reducidos en móvil: Leyenda más angosta, textos y rectángulos más pequeños, espaciado ajustado.
//    - Sin cortes de texto: El ancho del SVG se ajustó para que textos largos como “Indicador de Vegetación” no se recorten.
//    - Consistencia visual: Apariencia y jerarquía visual coherentes en ambas versiones, asegurando legibilidad y alineación.
// -----------------------------------------------------------------------------

// Importar funciones desde otros módulos
import { loadGeoJSONAndSetupLayers, createAvSelector, positionAvSelector } from './capas/utilis_select_av.js';
import { map_stdev, createDevLegendSVG } from './ndvi_trend_dev/stddev.js'; // Ajusta la ruta según tu estructura de carpetas
import { loadinf_critica } from '../inf_critica_leaflet.js';
import { attachMapOpacityPanel } from '../slider_opacity.js';

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

    // Cargar capa de infraestructura crítica
    const infCriticaData = await loadinf_critica(currentMap);

    // Crear un `layerGroup` para agrupar todas las capas de infraestructura crítica
    let infCriticaLayer = null;
    if (infCriticaData && typeof infCriticaData === 'object') {
        const layersArray = Object.values(infCriticaData); // Obtener todas las capas
        infCriticaLayer = L.layerGroup(layersArray); // Crear el layerGroup con todas las capas
    } else {
        console.error("La capa de infraestructura crítica no es válida:", infCriticaData);
    }

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

    // Raster siempre visible; solo infraestructura crítica como overlay opcional (vectores)
    const overlayMaps = {};
    if (infCriticaLayer) {
        overlayMaps["Infraestructura crítica (vectores)"] = infCriticaLayer;
    }
    if (Object.keys(overlayMaps).length > 0) {
        L.control.layers(null, overlayMaps, { position: 'topright' }).addTo(currentMap);
    }

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

    attachMapOpacityPanel(
        currentMap.getContainer(),
        (opacity) => {
            if (rasterLayer) rasterLayer.setOpacity(opacity);
            if (categoryLayersArray && categoryLayersArray.length > 0) {
                categoryLayersArray.forEach((layer) => {
                    layer.setStyle({ opacity, fillOpacity: opacity });
                });
            }
        },
        { leafletMap: currentMap },
    );

    // Llamar a la función para agregar el SVG en la parte inferior centrada del mapa
    addBottomCenteredSVG(currentMap);
}

// Función para crear y posicionar una leyenda personalizada en centro-izquierda
function addCustomLegend(map, legendHTML) {
    legendDiv = L.DomUtil.create('div', 'map-legend-panel');
    legendDiv.id = 'legend';
    legendDiv.innerHTML = legendHTML;
    map.getContainer().appendChild(legendDiv);
}

// Función para agregar un SVG/cuadro de texto en la parte inferior centrada del mapa
function addBottomCenteredSVG(map) {
    // Crear un div para contener el SVG/cuadro de texto
    const svgContainer = L.DomUtil.create('div', 'bottom-centered-svg');

    // Contenido del SVG o cuadro de texto
    svgContainer.innerHTML = `
        <svg width="350" height="60" xmlns="http://www.w3.org/2000/svg">
            <rect width="350" height="60" style="fill:rgba(255, 255, 255, 0.5);stroke:black;stroke-width:2;"/>
            <text x="50%" y="25" dominant-baseline="middle" text-anchor="middle" font-size="11" fill="black" style="word-spacing: 1px;">
                Para áreas vegetadas, los valores más altos de "DE" indican mayor
            </text>
            <text x="50%" y="35" dominant-baseline="middle" text-anchor="middle" font-size="11" fill="black" style="word-spacing: 1px;">
                variabilidad en el verdor, lo que puede estar asociado a la
            </text>
            <text x="50%" y="45" dominant-baseline="middle" text-anchor="middle" font-size="11" fill="black" style="word-spacing: 1px;">
                presencia de hierbas estacionales o vegetación caducifolia
            </text>
        </svg>
    `;

    // Agregar el div al contenedor del mapa
    map.getContainer().appendChild(svgContainer);

    // Estilos CSS para posicionar el div en la parte inferior centrada
    Object.assign(svgContainer.style, {
        position: 'absolute',
        bottom: '10px', // Espacio desde el borde inferior
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: '1000', // Asegura que esté visible por encima de otros elementos
        background: 'rgba(255, 255, 255, 0.8)',
        padding: '5px',
        borderRadius: '8px',
        boxShadow: '0 0 10px rgba(0, 0, 0, 0.3)'
    });
}
