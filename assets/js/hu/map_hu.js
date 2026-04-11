import { map_2018 } from './function/year_2018.js';
import { map_2019 } from './function/year_2019.js';
import { map_2020 } from './function/year_2020.js';
import { map_2021 } from './function/year_2021.js';
import { map_2022 } from './function/year_2022.js';
import { map_2023 } from './function/year_2023.js';
import { map_2024 } from './function/year_2024.js';
import { map_2025 } from './function/year_2025.js';
import { map_2026 } from './function/year_2026.js';
import { addCenteredTitle, createLegendSVG } from './function/map_utilities_p.js';
import { loadinf_critica } from '../inf_critica_leaflet.js';
import { attachMapOpacityPanel } from '../slider_opacity.js';

let currentMap = null;
let currentLayers = {};
let legendDiv = null;
let mapTitleDiv = null;

export async function map_hu() {
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        currentLayers = {};

        if (mapTitleDiv) {
            mapTitleDiv.remove();
            mapTitleDiv = null;
        }

        if (legendDiv) {
            legendDiv.remove();
            legendDiv = null;
        }
    }

    currentMap = L.map("p47").setView([-33.04752000, -71.44249000], 12.6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);

    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);

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

    const infCriticaData = await loadinf_critica(currentMap);
    if (infCriticaData && typeof infCriticaData === 'object') {
        const layersArray = Object.values(infCriticaData);
        overlayLayers["Infraestructura crítica (vectores)"] = L.layerGroup(layersArray);
    }

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

    addCenteredTitle(currentMap);

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
