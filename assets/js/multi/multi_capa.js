import { m_noche } from './multi_ilu.js';
import { m_rgb } from './multi_rgb.js';
import { m_tem } from './multi_tem.js';
import { addCenteredTitle_noche, addCenteredTitle_rgb, addCenteredTitle_temp } from './map_titule_m.js';
import { addLegend_noche, addLegend_temp, removeLegend } from './map_legend_m.js';
import { loadinf_critica } from '../inf_critica_leaflet.js';

let currentMap = null;
let currentLayers = {};
let legendDiv = null;
let mapTitleDiv = null;

export async function multi_capa() {
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        currentLayers = {};

        if (legendDiv) {
            legendDiv.remove();
            legendDiv = null;
        }

        if (mapTitleDiv) {
            mapTitleDiv.remove();
            mapTitleDiv = null;
        }
    }

    currentMap = L.map("p75");

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 23,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);

    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);

    let bounds = null;

    currentLayers["Plaza Vieja Dia RGB"] = await m_rgb(currentMap);
    currentLayers["Plaza Vieja Dia Termico"] = await m_tem(currentMap);
    currentLayers["Plaza Vieja Noche"] = await m_noche(currentMap);

    const baseLayers = Object.fromEntries(
        Object.entries({
            "Plaza Vieja día (RGB)": currentLayers["Plaza Vieja Dia RGB"],
            "Plaza Vieja día (térmico)": currentLayers["Plaza Vieja Dia Termico"],
            "Plaza Vieja noche": currentLayers["Plaza Vieja Noche"]
        }).filter(([, layer]) => Boolean(layer))
    );

    const infCriticaData = await loadinf_critica(currentMap);
    const overlayOnly = {};
    if (infCriticaData && typeof infCriticaData === 'object') {
        const layersArray = Object.values(infCriticaData);
        overlayOnly["Infraestructura crítica (vectores)"] = L.layerGroup(layersArray);
    }

    Object.values(currentLayers).forEach(layer => {
        if (layer && layer.getBounds) {
            const layerBounds = layer.getBounds();
            bounds = bounds ? bounds.extend(layerBounds) : layerBounds;
        } else if (layer && layer.georaster) {
            const { xmin, ymin, xmax, ymax } = layer.georaster;
            const rasterBounds = L.latLngBounds(
                [ymin, xmin],
                [ymax, xmax]
            );
            bounds = bounds ? bounds.extend(rasterBounds) : rasterBounds;
        }
    });

    if (bounds) {
        currentMap.fitBounds(bounds);
    } else {
        currentMap.setView([-33.04752000, -71.44249000], 12.6);
    }

    const defaultLayerName = Object.keys(baseLayers)[0];
    if (defaultLayerName) {
        currentMap.addLayer(baseLayers[defaultLayerName]);
    }
    addCenteredTitle_rgb(currentMap);

    const layerControl = L.control.layers(baseLayers, overlayOnly).addTo(currentMap);
    const layersList = layerControl.getContainer().querySelector('.leaflet-control-layers-list');
    const title = document.createElement('h4');
    title.innerHTML = 'Multicapa — vista';
    title.classList.add('leaflet-control-title');
    const separator = document.createElement('div');
    separator.classList.add('leaflet-control-layers-separator');
    layersList.prepend(separator);
    layersList.prepend(title);

    currentMap.on('baselayerchange', function (e) {
        removeLegend(currentMap);
        if (e.layer === currentLayers["Plaza Vieja Dia RGB"]) {
            addCenteredTitle_rgb(currentMap);
        } else if (e.layer === currentLayers["Plaza Vieja Dia Termico"]) {
            addCenteredTitle_temp(currentMap);
            addLegend_temp(currentMap);
        } else if (e.layer === currentLayers["Plaza Vieja Noche"]) {
            addCenteredTitle_noche(currentMap);
            addLegend_noche(currentMap);
        }
    });
}

