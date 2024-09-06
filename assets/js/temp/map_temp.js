import { loadLayersyear } from './year/load_layer_year.js';
import { createYearSelector, positionYearSelector } from './year/utils_year.js';
import { loadLayersmonth } from './month/load_layer_month.js';
import { createMonthSelector, positionMonthSelector } from './month/utils_month.js';
import { createmonthLegendSVG, createyearLegendSVG } from './map_utilities_p.js';
import { loadGeoJSONAndSetupLayers, createAvSelector, positionAvSelector } from './capas/utilis_select_av.js';
import { map_trend } from './lst_trend/trend.js';

// Variables globales
let currentMap = null;
let leftLayer = null;
let rightLayer = null;
let sideBySideControl = null;
let avSelector = null;
let categoryLayers = {};
let mapTitleDiv = null; // Almacenará las capas de categorías de áreas verdes
let legendDiv = null; // Variable global para la leyenda

function updateCenteredTitle(map, titleText) {
    if (!mapTitleDiv) {
        mapTitleDiv = document.createElement('div');
        mapTitleDiv.id = 'map-title';
        mapTitleDiv.style.position = 'absolute';
        mapTitleDiv.style.top = '10px';
        mapTitleDiv.style.left = '50%';
        mapTitleDiv.style.transform = 'translate(-50%, 0)';
        mapTitleDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        mapTitleDiv.style.padding = '10px';
        mapTitleDiv.style.borderRadius = '8px';
        mapTitleDiv.style.zIndex = '1000';
        mapTitleDiv.style.pointerEvents = 'none';
        mapTitleDiv.style.fontFamily = 'Arial';
        mapTitleDiv.style.fontSize = '14px';
        mapTitleDiv.style.fontWeight = 'bold';
        map.getContainer().appendChild(mapTitleDiv);
    }
    mapTitleDiv.innerHTML = titleText;
}

export async function map_t() {
    // Elimina el mapa y la leyenda si ya están inicializados
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        leftLayer = null;
        rightLayer = null;
        sideBySideControl = null;
        
        // Eliminar el título del mapa
        if (mapTitleDiv) {
            mapTitleDiv.remove();
            mapTitleDiv = null;
        }

        // Eliminar la leyenda si existe
        if (legendDiv) {
            legendDiv.remove();
            legendDiv = null;
        }
    }

    // Crear el mapa
    currentMap = L.map("p10").setView([-33.04752000, -71.44249000], 12.6);

    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);

    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);

    // Cargar y configurar las capas GeoJSON sin crear el selector
    categoryLayers = await loadGeoJSONAndSetupLayers(currentMap);

    // Actualizar el título del mapa
    updateCenteredTitle(currentMap, "LST Pixel Distrito Urbano");

    const Layersmonth = await loadLayersmonth(currentMap);
    const LayersYearth = await loadLayersyear(currentMap);
    const baseLayers = { "CDP": CartoDB_Positron };
    const areasVerdesLayer = L.layerGroup(Object.values(categoryLayers)); // Capa combinada de todas las categorías de áreas verdes

    const yearLeftSelector = createYearSelector('yearLeft');
    const yearRightSelector = createYearSelector('yearRight');
    const monthLeftSelector = createMonthSelector('monthLeft');
    const monthRightSelector = createMonthSelector('monthRight');

    positionYearSelector(yearLeftSelector, 'left');
    positionYearSelector(yearRightSelector, 'right');
    positionMonthSelector(monthLeftSelector, 'left');
    positionMonthSelector(monthRightSelector, 'right');

    yearLeftSelector.style.display = 'none';
    yearRightSelector.style.display = 'none';
    monthLeftSelector.style.display = 'none';
    monthRightSelector.style.display = 'none';

    // Inicialización de las capas de meses
    let leftMonthLayer = Layersmonth["LST 01"];
    let rightMonthLayer = Layersmonth["LST 12"];

    // Inicialización de las capas de años
    const initialLeftLayerKey = "LST 2017";
    const initialRightLayerKey = "LST 2023";

    if (LayersYearth[initialLeftLayerKey] && LayersYearth[initialRightLayerKey]) {
        leftLayer = LayersYearth[initialLeftLayerKey];
        rightLayer = LayersYearth[initialRightLayerKey];
    } else {
        return;
    }

    sideBySideControl = L.control.sideBySide(leftLayer, rightLayer).addTo(currentMap);

    // Event listeners para los cambios de capas de año
    document.getElementById('yearLeft').addEventListener('change', function() {
        const selectedYearLeft = this.value;
        const newLeftLayer = LayersYearth[`LST ${selectedYearLeft}`];
        if (newLeftLayer) {
            if (leftLayer) currentMap.removeLayer(leftLayer);
            leftLayer = newLeftLayer;
            currentMap.addLayer(leftLayer);
            sideBySideControl.setLeftLayers(leftLayer);
        }
    });

    document.getElementById('yearRight').addEventListener('change', function() {
        const selectedYearRight = this.value;
        const newRightLayer = LayersYearth[`LST ${selectedYearRight}`];
        if (newRightLayer) {
            if (rightLayer) currentMap.removeLayer(rightLayer);
            rightLayer = newRightLayer;
            currentMap.addLayer(rightLayer);
            sideBySideControl.setRightLayers(rightLayer);
        }
    });

    // Event listeners para los cambios de capas de mes
    document.getElementById('monthLeft').addEventListener('change', function() {
        const selectedMonthLeft = this.value;
        const newLeftLayer = Layersmonth[`LST ${selectedMonthLeft}`];
        if (newLeftLayer) {
            if (leftMonthLayer) currentMap.removeLayer(leftMonthLayer);
            leftMonthLayer = newLeftLayer;
            currentMap.addLayer(leftMonthLayer);
            sideBySideControl.setLeftLayers(leftMonthLayer);
        }
    });

    document.getElementById('monthRight').addEventListener('change', function() {
        const selectedMonthRight = this.value;
        const newRightLayer = Layersmonth[`LST ${selectedMonthRight}`];
        if (newRightLayer) {
            if (rightMonthLayer) currentMap.removeLayer(rightMonthLayer);
            rightMonthLayer = newRightLayer;
            currentMap.addLayer(rightMonthLayer);
            sideBySideControl.setRightLayers(rightMonthLayer);
        }
    });

    const YearLayer = L.layerGroup();
    const MonthLayer = L.layerGroup();
    const overlayLayers = {
        "LST Year": YearLayer,
        "LST Month": MonthLayer,
        "LST Trend": await map_trend(currentMap),
        //"Áreas Verdes": areasVerdesLayer
    };

    L.control.layers(baseLayers, overlayLayers).addTo(currentMap);

    currentMap.on('overlayadd', function(event) {
        if (legendDiv) {
            legendDiv.remove();
        }

        legendDiv = document.createElement('div');
        legendDiv.id = 'legend';
        legendDiv.style.position = 'absolute';
        legendDiv.style.top = '50%';
        legendDiv.style.left = '10px';
        legendDiv.style.transform = 'translateY(-50%)';
        legendDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        legendDiv.style.padding = '10px';
        legendDiv.style.borderRadius = '8px';
        legendDiv.style.zIndex = '1000';
        currentMap.getContainer().appendChild(legendDiv);

        if (event.name === "LST Year") {
            yearLeftSelector.style.display = 'block';
            yearRightSelector.style.display = 'block';
            monthLeftSelector.style.display = 'none';
            monthRightSelector.style.display = 'none';
            if (leftLayer) currentMap.addLayer(leftLayer);
            if (rightLayer) currentMap.addLayer(rightLayer);
            if (avSelector) avSelector.style.display = 'none';
            legendDiv.innerHTML = createyearLegendSVG();
        } else if (event.name === "LST Month") {
            monthLeftSelector.style.display = 'block';
            monthRightSelector.style.display = 'block';
            yearLeftSelector.style.display = 'none';
            yearRightSelector.style.display = 'none';
            if (leftMonthLayer) currentMap.addLayer(leftMonthLayer);
            if (rightMonthLayer) currentMap.addLayer(rightMonthLayer);
            if (avSelector) avSelector.style.display = 'none';
            legendDiv.innerHTML = createmonthLegendSVG();
        } else if (event.name === "Áreas Verdes") {
            if (!avSelector) {
                avSelector = createAvSelector('av-selector', categoryLayers, currentMap);
                positionAvSelector(avSelector, 'top');
            }
            avSelector.style.display = 'block';
        }
    });

    currentMap.on('overlayremove', function(event) {
        if (event.name === "LST Year") {
            yearLeftSelector.style.display = 'none';
            yearRightSelector.style.display = 'none';
            if (leftLayer) currentMap.removeLayer(leftLayer);
            if (rightLayer) currentMap.removeLayer(rightLayer);
        } else if (event.name === "LST Month") {
            monthLeftSelector.style.display = 'none';
            monthRightSelector.style.display = 'none';
            if (leftMonthLayer) currentMap.removeLayer(leftMonthLayer);
            if (rightMonthLayer) currentMap.removeLayer(rightMonthLayer);
        }

        if (legendDiv) {
            legendDiv.innerHTML = '';
        }
    });
}
