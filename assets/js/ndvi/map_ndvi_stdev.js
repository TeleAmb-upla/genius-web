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
import { addCenteredTitle } from './map_utilities_p.js';
import { geniusTitleForProduct, removeGeniusLeafletMapTitle } from '../map_data_catalog.js';
import { attachMapOpacityPanel } from '../slider_opacity.js';
import { GENIUS_LAT, GENIUS_LNG, GENIUS_ZOOM_URBAN, GENIUS_LEAFLET_MAP_OPTIONS, addGeniusLeafletZoomControl } from '../map_interaction_defaults.js';
import { physicalNdviStdDev } from '../raster_quantized_decode.js';

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
        removeGeniusLeafletMapTitle(currentMap);
        if (legendDiv) {
            legendDiv.remove();
            legendDiv = null;
        }
        currentMap.remove();
        currentMap = null;
        stdevGeoraster = null;
        rasterLayer = null;
        avSelector = null;
        categoryLayers = {};
    }

    // Un solo control +/- (Leaflet añade uno por defecto si no se desactiva)
    currentMap = L.map("p67", {
        ...GENIUS_LEAFLET_MAP_OPTIONS,
        zoomControl: false,
    }).setView([GENIUS_LAT, GENIUS_LNG], GENIUS_ZOOM_URBAN);

    // Capa base de CartoDB
    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(currentMap);

    // Agregar escala métrica en la esquina inferior izquierda
    L.control.scale({
        position: 'bottomright',
        metric: true,
        imperial: false
    }).addTo(currentMap);
    addGeniusLeafletZoomControl(currentMap);

    addCenteredTitle(
        currentMap,
        geniusTitleForProduct(
            'Variación del NDVI — mapa por píxel',
            'ndvi',
        ),
    );

    // Cargar y configurar las capas GeoJSON
    categoryLayers = await loadGeoJSONAndSetupLayers(currentMap);

    // Crear el selector de capas de áreas verdes
    avSelector = createAvSelector('av-selector', categoryLayers, currentMap);

    // Esquina superior derecha: no compite con el título (arriba-centro del layout)
    positionAvSelector(avSelector, 'top-right', 0, -42);

    // **Ajustar el z-index del avSelector para que esté por encima del slider**
    const avSelectorContainer = document.getElementById('av-selector');
    if (avSelectorContainer) {
        avSelectorContainer.style.zIndex = '1100'; // Asegura que esté por encima del slider
    }

    // Convertir categoryLayers a un array de capas
    const categoryLayersArray = Object.values(categoryLayers);

    // Cargar y agregar la capa raster de desviación estándar
    const rasterData = await map_stdev(currentMap);
    if (rasterData?.georaster && rasterData?.layer) {
        stdevGeoraster = rasterData.georaster;
        rasterLayer = rasterData.layer;
        rasterLayer.addTo(currentMap);
    } else {
        stdevGeoraster = null;
        rasterLayer = null;
        console.warn(
            "[NDVI DE] Sin capa raster; revise NDVI_SD y la consola de red.",
        );
    }

    // Crear y agregar la leyenda del raster en centro-izquierda (siempre visible)
    addCustomLegend(currentMap, createDevLegendSVG());

    // Añadir evento de clic para mostrar el valor del raster (valor físico DE)
    currentMap.on('click', function(event) {
        if (!stdevGeoraster) return;
        const latlng = event.latlng;
        const valueArray = geoblaze.identify(stdevGeoraster, [latlng.lng, latlng.lat]);
        const raw = valueArray && valueArray.length > 0 ? valueArray[0] : null;
        const phys = physicalNdviStdDev(raw);
        const value = Number.isFinite(phys) ? phys.toFixed(3) : 'No disponible';

        const content = `
            <div style="text-align:center; padding:2px; background-color:#fff; font-size:10px; max-width:140px;">
                DE NDVI: ${value}
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
            if (rasterLayer && typeof rasterLayer.setOpacity === "function") {
                rasterLayer.setOpacity(opacity);
            }
            if (categoryLayersArray && categoryLayersArray.length > 0) {
                categoryLayersArray.forEach((layer) => {
                    layer.setStyle({ opacity, fillOpacity: opacity });
                });
            }
        },
        { leafletMap: currentMap },
    );

    addStdevMapFootnote(currentMap);
}

// Función para crear y posicionar una leyenda personalizada en centro-izquierda
function addCustomLegend(map, legendHTML) {
    legendDiv = L.DomUtil.create('div', 'map-legend-panel');
    legendDiv.id = 'legend';
    legendDiv.innerHTML = legendHTML;
    map.getContainer().appendChild(legendDiv);
}

/** Nota bajo el mapa: alineada al panel de leyenda (izquierda), lejos del slider de opacidad (centro-abajo). */
function addStdevMapFootnote(map) {
    const el = L.DomUtil.create("div", "map-stdev-footnote");
    el.innerHTML = `
        <svg width="280" height="52" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect width="280" height="52" rx="6" style="fill:rgba(255,255,255,0.94);stroke:#64748b;stroke-width:1;"/>
            <text x="12" y="17" text-anchor="start" font-size="10.5" fill="#0f172a" font-family="system-ui,Arial,sans-serif">
                Mayor DE → mayor variación del verdor (p. ej. hierbas estacionales o caducifolia).
            </text>
            <text x="12" y="33" text-anchor="start" font-size="10" fill="#475569" font-family="system-ui,Arial,sans-serif">
                Active categorías (panel superior derecho) solo si necesita delimitar tipos.
            </text>
        </svg>
    `;
    map.getContainer().appendChild(el);
    Object.assign(el.style, {
        position: "absolute",
        left: "12px",
        bottom: "12px",
        right: "auto",
        transform: "none",
        zIndex: "950",
        pointerEvents: "none",
        maxWidth: "min(288px, 48vw)",
        boxSizing: "border-box",
    });
}
