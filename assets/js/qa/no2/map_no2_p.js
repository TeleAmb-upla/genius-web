import { loadLayersyear } from './year/load_layer_year.js';
import { createYearSelector, positionYearSelector } from './year/utils_year.js';
import { loadLayersmonth } from './month/load_layer_month.js';
import { createMonthSelector, positionMonthSelector } from './month/utils_month.js';
import { map_trend } from './no2_trend/trend.js';
import { createmonthLegendSVG, createyearLegendSVG } from './map_utilities_p.js';

// Variables globales para almacenar el estado del mapa, las capas y el título
let currentMap = null;
let leftLayer = null;
let rightLayer = null;
let sideBySideControl = null;
let mapTitleDiv = null;  // Variable global para almacenar el elemento del título
let legendDiv = null;
// Función para agregar o actualizar el título centrado al mapa
function updateCenteredTitle(map, titleText) {
    if (!mapTitleDiv) {
        // Crear el elemento del título si no existe
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

    // Actualiza el contenido del título
    mapTitleDiv.innerHTML = titleText;
}

export async function map_no2_p() {
    // Comprueba si el mapa ya está inicializado y elimínalo si es necesario
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        leftLayer = null;
        rightLayer = null;
        sideBySideControl = null;
        // También eliminamos el título del mapa si existe
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
    currentMap = L.map("p28").setView([-33.04752000, -71.44249000], 10.9);

    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);
        

    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);

    // Actualizar el título del mapa
    updateCenteredTitle(currentMap, "NO² Pixel Distrito Urbano");

    const Layersmonth = await loadLayersmonth(currentMap);
    const LayersYearth = await loadLayersyear(currentMap);
    const baseLayers = { "CDP": CartoDB_Positron };

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

    const initialLeftLayerKey = "NO² 2019";
    const initialRightLayerKey = "NO² 2023";

    if (LayersYearth[initialLeftLayerKey] && LayersYearth[initialRightLayerKey]) {
        leftLayer = LayersYearth[initialLeftLayerKey];
        rightLayer = LayersYearth[initialRightLayerKey];
    } else {
        return;
    }

    sideBySideControl = L.control.sideBySide(leftLayer, rightLayer).addTo(currentMap);

    document.getElementById('yearLeft').addEventListener('change', function() {
        const selectedYearLeft = this.value;
        const newLeftLayer = LayersYearth[`NO² ${selectedYearLeft}`];
        if (newLeftLayer) {
            if (leftLayer) currentMap.removeLayer(leftLayer);
            leftLayer = newLeftLayer;
            currentMap.addLayer(leftLayer);
            sideBySideControl.setLeftLayers(leftLayer);
        }
    });

    document.getElementById('yearRight').addEventListener('change', function() {
        const selectedYearRight = this.value;
        const newRightLayer = LayersYearth[`NO² ${selectedYearRight}`];
        if (newRightLayer) {
            if (rightLayer) currentMap.removeLayer(rightLayer);
            rightLayer = newRightLayer;
            currentMap.addLayer(rightLayer);
            sideBySideControl.setRightLayers(rightLayer);
        }
    });

    document.getElementById('monthLeft').addEventListener('change', function() {
        const selectedMonthLeft = this.value;
        const newLeftLayer = Layersmonth[`NO² ${selectedMonthLeft}`];
        if (newLeftLayer) {
            if (leftLayer) currentMap.removeLayer(leftLayer);
            leftLayer = newLeftLayer;
            currentMap.addLayer(leftLayer);
            sideBySideControl.setLeftLayers(leftLayer);
        }
    });

    document.getElementById('monthRight').addEventListener('change', function() {
        const selectedMonthRight = this.value;
        const newRightLayer = Layersmonth[`NO² ${selectedMonthRight}`];
        if (newRightLayer) {
            if (rightLayer) currentMap.removeLayer(rightLayer);
            rightLayer = newRightLayer;
            currentMap.addLayer(rightLayer);
            sideBySideControl.setRightLayers(rightLayer);
        }
    });

    const YearLayer = L.layerGroup();  
    const MonthLayer = L.layerGroup(); 
    const overlayLayers = {
        "NO² Year": YearLayer,
        "NO² Month": MonthLayer,
        "NO² Trend" : await map_trend(currentMap)
    };

    L.control.layers(baseLayers, overlayLayers).addTo(currentMap);

    currentMap.on('overlayadd', function(event) {
            // Asegurarse de eliminar la leyenda anterior
            if (legendDiv) {
                legendDiv.remove();
            }

            // Crear una nueva leyenda
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



        if (event.name === "NO² Year") {
            yearLeftSelector.style.display = 'block';
            yearRightSelector.style.display = 'block';
            monthLeftSelector.style.display = 'none';
            monthRightSelector.style.display = 'none';
            if (leftLayer) currentMap.addLayer(leftLayer);
            if (rightLayer) currentMap.addLayer(rightLayer);
            legendDiv.innerHTML = createyearLegendSVG(); // Mostrar leyenda para LST Year

        } else if (event.name === "NO² Month") {
            monthLeftSelector.style.display = 'block';
            monthRightSelector.style.display = 'block';
            yearLeftSelector.style.display = 'none';
            yearRightSelector.style.display = 'none';
            if (leftLayer) currentMap.addLayer(leftLayer);
            if (rightLayer) currentMap.addLayer(rightLayer);
            legendDiv.innerHTML = createmonthLegendSVG(); // Mostrar leyenda para LST Month

        }
    });

    currentMap.on('overlayremove', function(event) {
        if (event.name === "NO² Year") {
            yearLeftSelector.style.display = 'none';
            yearRightSelector.style.display = 'none';
            if (leftLayer) currentMap.removeLayer(leftLayer);
            if (rightLayer) currentMap.removeLayer(rightLayer);
        } else if (event.name === "NO² Month") {
            monthLeftSelector.style.display = 'none';
            monthRightSelector.style.display = 'none';
            if (leftLayer) currentMap.removeLayer(leftLayer);
            if (rightLayer) currentMap.removeLayer(rightLayer);
        }
                // Limpiar la leyenda si se elimina cualquier capa
                if (legendDiv) {
                    legendDiv.innerHTML = '';
                }
    });
}
