import { map_2018 } from './function/year_2018.js';
import { map_2019 } from './function/year_2019.js';
import { map_2020 } from './function/year_2020.js';
import { map_2021 } from './function/year_2021.js';
import { map_2022 } from './function/year_2022.js';
import { map_2023 } from './function/year_2023.js';
import { map_2024 } from './function/year_2024.js';
import { map_2025 } from './function/year_2025.js';
import { map_2026 } from './function/year_2026.js';
import { geniusTitleForProduct, removeGeniusLeafletMapTitle } from '../map_data_catalog.js';
import { addCenteredTitle, createLegendSVG } from './function/map_utilities_p.js';
import { attachMapOpacityPanel } from '../slider_opacity.js';
import { GENIUS_LAT, GENIUS_LNG, GENIUS_ZOOM_URBAN, GENIUS_LEAFLET_MAP_OPTIONS, addGeniusLeafletZoomControl } from '../map_interaction_defaults.js';

let currentMap = null;
let currentLayers = {};
let legendDiv = null;

const HU_PRELIMINARY_NOTICE_ID = "map-hu-preliminary-notice";

function removeHuPreliminaryNotice() {
    document.getElementById(HU_PRELIMINARY_NOTICE_ID)?.remove();
}

function addHuPreliminaryNotice(map) {
    removeHuPreliminaryNotice();
    const el = document.createElement("div");
    el.id = HU_PRELIMINARY_NOTICE_ID;
    el.className = "map-hu-preliminary-notice";
    el.setAttribute("role", "note");
    el.innerHTML =
        "<strong>Datos preliminares.</strong> La serie puede mostrar variaciones entre años por limitaciones del modelo y de las imágenes; " +
        "una menor superficie clasificada <strong>no implica por sí sola</strong> que el tejido urbano haya disminuido " +
        "(p. ej. efectos de nubosidad, estación o umbrales de clasificación).";
    map.getContainer().appendChild(el);
}

export async function map_hu() {
    if (currentMap) {
        removeGeniusLeafletMapTitle(currentMap);
        currentMap.remove();
        currentMap = null;
        currentLayers = {};

        if (legendDiv) {
            legendDiv.remove();
            legendDiv = null;
        }
        removeHuPreliminaryNotice();
    }

    currentMap = L.map("p47", GENIUS_LEAFLET_MAP_OPTIONS).setView([GENIUS_LAT, GENIUS_LNG], GENIUS_ZOOM_URBAN);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);

    L.control.scale({ position: 'bottomright', metric: true, imperial: false }).addTo(currentMap);
    addGeniusLeafletZoomControl(currentMap);

    const yearlyLayers = [
        ["Huella Urbana 2026", map_2026],
        ["Huella Urbana 2025", map_2025],
        ["Huella Urbana 2024", map_2024],
        ["Huella Urbana 2023", map_2023],
        ["Huella Urbana 2022", map_2022],
        ["Huella Urbana 2021", map_2021],
        ["Huella Urbana 2020", map_2020],
        ["Huella Urbana 2019", map_2019],
        ["Huella Urbana 2018", map_2018],
    ];
    const settledLayers = await Promise.allSettled(
        yearlyLayers.map(async ([name, loader]) => [name, await loader(currentMap)])
    );
    const overlayLayers = {};
    settledLayers.forEach((result) => {
        if (result.status !== 'fulfilled') {
            console.warn('Huella urbana:', result.reason);
            return;
        }
        const [name, layer] = result.value;
        if (!layer) return;
        currentLayers[name] = layer;
        overlayLayers[name] = layer;
    });

    const layerControl = L.control.layers(null, overlayLayers).addTo(currentMap);
    const layersList = layerControl.getContainer().querySelector('.leaflet-control-layers-list');
    const title = document.createElement('h4');
    title.innerHTML = 'Huella — año';
    title.classList.add('leaflet-control-title');
    const separator = document.createElement('div');
    separator.classList.add('leaflet-control-layers-separator');
    layersList.prepend(separator);
    layersList.prepend(title);

    const defaultLayer = Object.keys(overlayLayers)[0];
    if (defaultLayer && currentLayers[defaultLayer]) {
        currentMap.addLayer(currentLayers[defaultLayer]);
    }

    addCenteredTitle(currentMap, geniusTitleForProduct("Huella urbana anual", "hu"));
    addHuPreliminaryNotice(currentMap);

    if (legendDiv) {
        legendDiv.remove();
    }

    legendDiv = document.createElement('div');
    legendDiv.id = 'legend';
    legendDiv.className = 'map-legend-panel';
    currentMap.getContainer().appendChild(legendDiv);

    legendDiv.innerHTML = createLegendSVG();

    attachMapOpacityPanel(
        currentMap.getContainer(),
        (opacity) => {
            Object.entries(currentLayers).forEach(([name, layer]) => {
                if (!name.startsWith('Huella Urbana ')) return;
                if (layer && currentMap.hasLayer(layer) && typeof layer.setOpacity === 'function') {
                    layer.setOpacity(opacity);
                }
            });
        },
        { leafletMap: currentMap },
    );
}
