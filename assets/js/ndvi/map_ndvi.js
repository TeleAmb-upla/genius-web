import { loadNdviLayersyear } from './ndvi_year/funtion_ndvi/load_layer_year.js';
import { createYearSelector, positionYearSelector } from './ndvi_year/funtion_ndvi/utils_year.js';
import { loadNdviLayersmonth } from './ndvi_month/funtion_ndvi_moth/load_layer_month.js';
import { createMonthSelector, positionMonthSelector } from './ndvi_month/funtion_ndvi_moth/utils_month.js';
import { createyearLegendSVG, createmonthLegendSVG, addCenteredTitle } from './map_utilities_p.js';
import { loadGeoJSONAndSetupLayers, createAvSelector, positionAvSelector } from './capas/utilis_select_av.js';
import { map_stdev, createDevLegendSVG } from './ndvi_trend_dev/stddev.js';
import { map_trend, createSTLegendSVG } from './ndvi_trend_dev/trend.js';

// Variables globales para almacenar el estado del mapa y las capas
let currentMap = null;
let leftLayer = null;
let rightLayer = null;
let sideBySideControl = null;
let avSelector = null;
let categoryLayers = {};
let mapTitleDiv = null; // Almacenará las capas de categorías de áreas verdes
let legendDiv = null; // Variable global para la leyenda

export async function map_ndvi() {
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        leftLayer = null;
        rightLayer = null;
        sideBySideControl = null;

        // Eliminar el título del mapa si existe
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

    // Inicializar el mapa
    currentMap = L.map("p01").setView([-33.04752000, -71.44249000], 12.6);

    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);
        

    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);

    // Cargar y configurar las capas GeoJSON sin crear el selector
    categoryLayers = await loadGeoJSONAndSetupLayers(currentMap);

    // Cargar capas de NDVI anuales y mensuales
    const ndviLayersmonth = await loadNdviLayersmonth(currentMap);
    const ndviLayersYearth = await loadNdviLayersyear(currentMap);

    // Definir capas base y superpuestas
    const baseLayers = { "CDP": CartoDB_Positron };
    const ndviYearLayer = L.layerGroup();  // Capa vacía para el control de capas
    const ndviMonthLayer = L.layerGroup(); // Capa vacía para el control de capas
    const areasVerdesLayer = L.layerGroup(Object.values(categoryLayers)); // Capa combinada de todas las categorías de áreas verdes

    // Añadir un solo control de capas para manejar tanto NDVI como categorías
    const overlayLayers = {
        "NDVI Year": ndviYearLayer,
        "NDVI Month": ndviMonthLayer,
        "NDVI Trend": await map_trend(currentMap),
        "NDVI StdDev": await map_stdev(currentMap),
        "Áreas Verdes": areasVerdesLayer
    };

    L.control.layers(baseLayers, overlayLayers).addTo(currentMap);

    // Creación de selectores de año y mes
    const yearLeftSelector = createYearSelector('yearLeft');
    const yearRightSelector = createYearSelector('yearRight');
    const monthLeftSelector = createMonthSelector('monthLeft');
    const monthRightSelector = createMonthSelector('monthRight');

    positionYearSelector(yearLeftSelector, 'left');
    positionYearSelector(yearRightSelector, 'right');
    positionMonthSelector(monthLeftSelector, 'left');
    positionMonthSelector(monthRightSelector, 'right');

    // Inicialmente ocultamos los selectores de año y mes
    yearLeftSelector.style.display = 'none';
    yearRightSelector.style.display = 'none';
    monthLeftSelector.style.display = 'none';
    monthRightSelector.style.display = 'none';

    // Capas iniciales para años
    leftLayer = ndviLayersYearth["NDVI 2017"];
    rightLayer = ndviLayersYearth["NDVI 2023"];

    // Capas iniciales para meses
    let leftMonthLayer = ndviLayersmonth["NDVI 01"];
    let rightMonthLayer = ndviLayersmonth["NDVI 12"];

    // Control side by side para las capas iniciales
    sideBySideControl = L.control.sideBySide(leftLayer, rightLayer).addTo(currentMap);

    // Listeners de eventos para cambios en los selectores de año
    document.getElementById('yearLeft').addEventListener('change', function() {
        const selectedYearLeft = this.value;
        const newLeftLayer = ndviLayersYearth[`NDVI ${selectedYearLeft}`];
        if (newLeftLayer) {
            currentMap.removeLayer(leftLayer); // Remover la capa actual
            leftLayer = newLeftLayer;
            currentMap.addLayer(leftLayer);
            sideBySideControl.setLeftLayers(leftLayer); // Configurar la nueva capa izquierda
        }
    });

    document.getElementById('yearRight').addEventListener('change', function() {
        const selectedYearRight = this.value;
        const newRightLayer = ndviLayersYearth[`NDVI ${selectedYearRight}`];
        if (newRightLayer) {
            currentMap.removeLayer(rightLayer); // Remover la capa actual
            rightLayer = newRightLayer;
            currentMap.addLayer(rightLayer);
            sideBySideControl.setRightLayers(rightLayer); // Configurar la nueva capa derecha
        }
    });

    // Listeners de eventos para cambios en los selectores de mes
    document.getElementById('monthLeft').addEventListener('change', function() {
        const selectedMonthLeft = this.value;
        const newLeftLayer = ndviLayersmonth[`NDVI ${selectedMonthLeft}`];
        if (newLeftLayer) {
            currentMap.removeLayer(leftMonthLayer); // Remover la capa actual
            leftMonthLayer = newLeftLayer;
            currentMap.addLayer(leftMonthLayer);
            sideBySideControl.setLeftLayers(leftMonthLayer); // Configurar la nueva capa izquierda
        }
    });

    document.getElementById('monthRight').addEventListener('change', function() {
        const selectedMonthRight = this.value;
        const newRightLayer = ndviLayersmonth[`NDVI ${selectedMonthRight}`];
        if (newRightLayer) {
            currentMap.removeLayer(rightMonthLayer); // Remover la capa actual
            rightMonthLayer = newRightLayer;
            currentMap.addLayer(rightMonthLayer);
            sideBySideControl.setRightLayers(rightMonthLayer); // Configurar la nueva capa derecha
        }
    });

    // Evento para mostrar/ocultar los selectores de año y mes
    currentMap.on('overlayadd', function(event) {
        // Asegurarse de eliminar la leyenda anterior
        if (legendDiv) {
            legendDiv.remove();
        }
    
        // Crear una nueva leyenda
        legendDiv = document.createElement('div');
        legendDiv.id = 'legend';
        legendDiv.style.position = 'absolute';
        legendDiv.style.top = '50%';  // Colocar en el centro vertical
        legendDiv.style.left = '10px';  // Colocar en la parte izquierda
        legendDiv.style.transform = 'translateY(-50%)';  // Ajustar para centrar verticalmente
        legendDiv.style.backgroundColor = 'rgba(255, 255, 255, 0.7)';
        legendDiv.style.padding = '10px';
        legendDiv.style.borderRadius = '8px';
        legendDiv.style.zIndex = '1000';
        currentMap.getContainer().appendChild(legendDiv);
    
        // Determinar qué leyenda mostrar basado en la capa que se activó
        switch (event.name) {
            case "NDVI Year":
                yearLeftSelector.style.display = 'block';
                yearRightSelector.style.display = 'block';
                monthLeftSelector.style.display = 'none';
                monthRightSelector.style.display = 'none';
                if (avSelector) avSelector.style.display = 'none';
                legendDiv.innerHTML = createyearLegendSVG();
    
                // Asegurar que las capas de años sean visibles
                if (!currentMap.hasLayer(leftLayer)) {
                    leftLayer = ndviLayersYearth["NDVI 2017"];
                    rightLayer = ndviLayersYearth["NDVI 2023"];
                    currentMap.addLayer(leftLayer);
                    currentMap.addLayer(rightLayer);
                    sideBySideControl.setLeftLayers(leftLayer);
                    sideBySideControl.setRightLayers(rightLayer);
                }
                break;
            case "NDVI Month":
                monthLeftSelector.style.display = 'block';
                monthRightSelector.style.display = 'block';
                yearLeftSelector.style.display = 'none';
                yearRightSelector.style.display = 'none';
                if (avSelector) avSelector.style.display = 'none';
                legendDiv.innerHTML = createmonthLegendSVG();
    
                // Asegurar que las capas de meses sean visibles
                if (!currentMap.hasLayer(leftMonthLayer)) {
                    leftMonthLayer = ndviLayersmonth["NDVI 01"];
                    rightMonthLayer = ndviLayersmonth["NDVI 12"];
                    currentMap.addLayer(leftMonthLayer);
                    currentMap.addLayer(rightMonthLayer);
                    sideBySideControl.setLeftLayers(leftMonthLayer);
                    sideBySideControl.setRightLayers(rightMonthLayer);
                }
                break;
            case "NDVI Trend":
                legendDiv.innerHTML = createSTLegendSVG();
                break;
            case "NDVI StdDev":
                legendDiv.innerHTML = createDevLegendSVG();
                break;
            case "Áreas Verdes":
                if (!avSelector) {
                    avSelector = createAvSelector('av-selector', categoryLayers, currentMap);
                    positionAvSelector(avSelector, 'top');
                }
                avSelector.style.display = 'block';
                break;
        }
    });
    

    currentMap.on('overlayremove', function(event) {
        if (event.name === "NDVI Year") {
            yearLeftSelector.style.display = 'none';
            yearRightSelector.style.display = 'none';
            currentMap.removeLayer(leftLayer);
            currentMap.removeLayer(rightLayer);
        } else if (event.name === "NDVI Month") {
            monthLeftSelector.style.display = 'none';
            monthRightSelector.style.display = 'none';
            currentMap.removeLayer(leftMonthLayer);
            currentMap.removeLayer(rightMonthLayer);
        } else if (event.name === "Áreas Verdes") {
            if (avSelector) avSelector.style.display = 'none'; // Ocultar el selector de áreas verdes
        }

        // Limpiar la leyenda si se elimina cualquier capa
        if (legendDiv) {
            legendDiv.innerHTML = '';
        }
    });

    // Añadir el título al mapa
    addCenteredTitle(currentMap);
}