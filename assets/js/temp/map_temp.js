// map_temp.js

// Importaciones necesarias
import { loadLayersyear } from './year/load_layer_year.js';
import { createYearSelector, positionYearSelector } from './year/utils_year.js';
import { loadLayersmonth } from './month/load_layer_month.js';
import { createMonthSelector, positionMonthSelector } from './month/utils_month.js';
import { createmonthLegendSVG, createyearLegendSVG, addCenteredTitle } from './map_utilities_p.js';
import { map_trend, createSTLegendSVG } from './lst_trend/trend.js';
import { createOpacitySlider } from '../slider_opacity.js';

// Variables globales
let currentMap = null;
let leftLayer = null;
let rightLayer = null;
let trendLayer = null; // Declarar trendLayer aquí
let sideBySideControl = null;

let legendDiv = null; // Variable global para la leyenda

let leftGeoraster = null;
let rightGeoraster = null;
let trendGeoraster = null;

let currentLayerType = null; // 'Anual', 'Mensual', 'Tendencia' o null

let currentLeftYear = "2014";
let currentRightYear = "2023";

let currentLeftMonth = "01";
let currentRightMonth = "12";

let currentLayerTypeRef = { value: null };

let layers = {
    leftLayer: null,
    rightLayer: null,
    trendLayer: null
};

export async function map_t() {
    // Elimina el mapa y la leyenda si ya están inicializados
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        leftLayer = null;
        rightLayer = null;
        trendLayer = null;
        sideBySideControl = null;

        // Eliminar el título del mapa
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

    // Crear el mapa
    currentMap = L.map("p10").setView([-33.04752000, -71.44249000], 12.6);

    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(currentMap);

    // Agregar escala métrica en la esquina superior derecha
    L.control.scale({
        position: 'topright', // Posición deseada
        metric: true,
        imperial: false
    }).addTo(currentMap);

    // Actualizar el título del mapa
    addCenteredTitle(currentMap, "LST Área Urbana (píxel)");

    // Cargar las capas anuales y mensuales
    const lstDataYear = await loadLayersyear(currentMap);
    const lstLayersYear = lstDataYear.layers;
    const lstGeorastersYear = lstDataYear.georasters;

    const lstDataMonth = await loadLayersmonth(currentMap);
    const lstLayersMonth = lstDataMonth.layers;
    const lstGeorastersMonth = lstDataMonth.georasters;

    // Crear selectores de año y mes
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

    // Definir capas base y superpuestas
    const lstYearLayer = L.layerGroup(); // Capa vacía para el control de capas
    const lstMonthLayer = L.layerGroup(); // Capa vacía para el control de capas

    // Cargar la capa de tendencia
    const trendLayerData = await map_trend(currentMap);
    trendLayer = trendLayerData ? trendLayerData.layer : null;
    trendGeoraster = trendLayerData ? trendLayerData.georaster : null;

    // Verificar que las capas no sean undefined
    const overlayLayers = {};

    if (lstYearLayer) overlayLayers["Anual"] = lstYearLayer;
    else console.error("lstYearLayer no está definido correctamente.");

    if (lstMonthLayer) overlayLayers["Mensual"] = lstMonthLayer;
    else console.error("lstMonthLayer no está definido correctamente.");

    if (trendLayer) overlayLayers["Tendencia"] = trendLayer;
    else console.error("trendLayer no está definido correctamente.");

    // Crear el control de capas solo si hay capas válidas
    if (Object.keys(overlayLayers).length > 0) {
        const layerControl = L.control.layers(null, overlayLayers).addTo(currentMap);

        // Obtener el div del control de capas
        const layerControlDiv = layerControl.getContainer();

        // Obtener la lista de capas
        const layersList = layerControlDiv.querySelector('.leaflet-control-layers-list');

        // Crear el título LST
        const title = document.createElement('h4');
        title.innerHTML = "LST"; // Texto del título
        title.classList.add('leaflet-control-title');

        // Crear el separador
        const separator = document.createElement('div');
        separator.classList.add('leaflet-control-layers-separator');

        // Insertar el título y luego el separador antes de la lista de capas
        layersList.prepend(separator); // Insertar el separador antes de las capas
        layersList.prepend(title);     // Insertar el título antes del separador
    } else {
        console.error("No hay capas válidas para agregar al control de capas.");
    }

    // Inicializar layers con los valores actuales de las capas
    layers.leftLayer = leftLayer;
    layers.rightLayer = rightLayer;
    layers.trendLayer = trendLayer;

    // Llamar a createOpacitySlider
    await createOpacitySlider(currentMap, layers, currentLayerTypeRef);

    // Variable para almacenar el tipo de capa actual
    currentLayerType = null; // 'Anual', 'Mensual', 'Tendencia' o null

    // Listeners para los selectores de año
    document.getElementById('yearLeft').addEventListener('change', function () {
        const selectedYear = this.value;
        currentLeftYear = selectedYear;

        const newLeftLayer = lstLayersYear[`LST ${selectedYear}`];
        const newLeftGeoraster = lstGeorastersYear[`LST ${selectedYear}`];

        if (leftLayer) currentMap.removeLayer(leftLayer);
        leftLayer = newLeftLayer;
        leftGeoraster = newLeftGeoraster;
        layers.leftLayer = leftLayer; // Actualizar layers
        currentMap.addLayer(leftLayer);

        if (sideBySideControl) {
            sideBySideControl.setLeftLayers(leftLayer);
        }
    });

    document.getElementById('yearRight').addEventListener('change', function () {
        const selectedYear = this.value;
        currentRightYear = selectedYear;

        const newRightLayer = lstLayersYear[`LST ${selectedYear}`];
        const newRightGeoraster = lstGeorastersYear[`LST ${selectedYear}`];

        if (rightLayer) currentMap.removeLayer(rightLayer);
        rightLayer = newRightLayer;
        rightGeoraster = newRightGeoraster;
        layers.rightLayer = rightLayer; // Actualizar layers
        currentMap.addLayer(rightLayer);

        if (sideBySideControl) {
            sideBySideControl.setRightLayers(rightLayer);
        }
    });

    // Listeners para los selectores de mes
    document.getElementById('monthLeft').addEventListener('change', function () {
        const selectedMonth = this.value;
        currentLeftMonth = selectedMonth;

        const newLeftLayer = lstLayersMonth[`LST ${selectedMonth}`];
        const newLeftGeoraster = lstGeorastersMonth[`LST ${selectedMonth}`];

        if (leftLayer) currentMap.removeLayer(leftLayer);
        leftLayer = newLeftLayer;
        leftGeoraster = newLeftGeoraster;
        layers.leftLayer = leftLayer; // Actualizar layers
        currentMap.addLayer(leftLayer);

        if (sideBySideControl) {
            sideBySideControl.setLeftLayers(leftLayer);
        }
    });

    document.getElementById('monthRight').addEventListener('change', function () {
        const selectedMonth = this.value;
        currentRightMonth = selectedMonth;

        const newRightLayer = lstLayersMonth[`LST ${selectedMonth}`];
        const newRightGeoraster = lstGeorastersMonth[`LST ${selectedMonth}`];

        if (rightLayer) currentMap.removeLayer(rightLayer);
        rightLayer = newRightLayer;
        rightGeoraster = newRightGeoraster;
        layers.rightLayer = rightLayer; // Actualizar layers
        currentMap.addLayer(rightLayer);

        if (sideBySideControl) {
            sideBySideControl.setRightLayers(rightLayer);
        }
    });

    // Eventos para mostrar/ocultar capas y selectores
    currentMap.on('overlayadd', function (event) {
        // Eliminar la leyenda previa si existe
        if (legendDiv) {
            legendDiv.remove();
        }

        // Crear un nuevo div para la leyenda
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

        // Lógica para mostrar la leyenda y las capas según la capa seleccionada
        switch (event.name) {
            case "Anual":
                currentLayerType = 'Anual';
                currentLayerTypeRef.value = 'Anual'; // Actualizar referencia
                yearLeftSelector.style.display = 'block';
                yearRightSelector.style.display = 'block';
                monthLeftSelector.style.display = 'none';
                monthRightSelector.style.display = 'none';
                legendDiv.innerHTML = createyearLegendSVG();

                // Asignar los georasters correspondientes
                leftGeoraster = lstGeorastersYear[`LST ${currentLeftYear}`];
                rightGeoraster = lstGeorastersYear[`LST ${currentRightYear}`];

                // Añadir las capas al mapa
                leftLayer = lstLayersYear[`LST ${currentLeftYear}`];
                rightLayer = lstLayersYear[`LST ${currentRightYear}`];
                currentMap.addLayer(leftLayer);
                currentMap.addLayer(rightLayer);

                layers.leftLayer = leftLayer; // Actualizar layers
                layers.rightLayer = rightLayer;

                // Agregar el control Side by Side
                sideBySideControl = L.control.sideBySide(leftLayer, rightLayer).addTo(currentMap);
                break;
            case "Mensual":
                currentLayerType = 'Mensual';
                currentLayerTypeRef.value = 'Mensual'; // Actualizar referencia
                monthLeftSelector.style.display = 'block';
                monthRightSelector.style.display = 'block';
                yearLeftSelector.style.display = 'none';
                yearRightSelector.style.display = 'none';
                legendDiv.innerHTML = createmonthLegendSVG();

                // Asignar los georasters correspondientes
                leftGeoraster = lstGeorastersMonth[`LST ${currentLeftMonth}`];
                rightGeoraster = lstGeorastersMonth[`LST ${currentRightMonth}`];

                // Añadir las capas al mapa
                leftLayer = lstLayersMonth[`LST ${currentLeftMonth}`];
                rightLayer = lstLayersMonth[`LST ${currentRightMonth}`];
                currentMap.addLayer(leftLayer);
                currentMap.addLayer(rightLayer);

                layers.leftLayer = leftLayer; // Actualizar layers
                layers.rightLayer = rightLayer;

                // Agregar el control Side by Side
                sideBySideControl = L.control.sideBySide(leftLayer, rightLayer).addTo(currentMap);
                break;
            case "Tendencia":
                currentLayerType = 'Tendencia';
                currentLayerTypeRef.value = 'Tendencia'; // Actualizar referencia
                // Ocultar selectores que no son necesarios
                yearLeftSelector.style.display = 'none';
                yearRightSelector.style.display = 'none';
                monthLeftSelector.style.display = 'none';
                monthRightSelector.style.display = 'none';

                legendDiv.innerHTML = createSTLegendSVG();
                trendGeoraster = trendLayerData.georaster;

                // Añadir la capa de tendencia al mapa si no está ya
                if (!currentMap.hasLayer(trendLayer)) {
                    currentMap.addLayer(trendLayer);
                }

                layers.trendLayer = trendLayer; // Actualizar layers

                break;
            // Puedes manejar otros casos aquí si es necesario
        }
    });

    currentMap.on('overlayremove', function (event) {
        if (event.name === "Anual") {
            yearLeftSelector.style.display = 'none';
            yearRightSelector.style.display = 'none';
            if (leftLayer) currentMap.removeLayer(leftLayer);
            if (rightLayer) currentMap.removeLayer(rightLayer);
            leftLayer = null;
            rightLayer = null;
            leftGeoraster = null;
            rightGeoraster = null;
            layers.leftLayer = null;
            layers.rightLayer = null;
            currentLayerType = null;
            currentLayerTypeRef.value = null;

            if (sideBySideControl) {
                sideBySideControl.remove();
                sideBySideControl = null;
            }
        } else if (event.name === "Mensual") {
            monthLeftSelector.style.display = 'none';
            monthRightSelector.style.display = 'none';
            if (leftLayer) currentMap.removeLayer(leftLayer);
            if (rightLayer) currentMap.removeLayer(rightLayer);
            leftLayer = null;
            rightLayer = null;
            leftGeoraster = null;
            rightGeoraster = null;
            layers.leftLayer = null;
            layers.rightLayer = null;
            currentLayerType = null;
            currentLayerTypeRef.value = null;

            if (sideBySideControl) {
                sideBySideControl.remove();
                sideBySideControl = null;
            }
        } else if (event.name === "Tendencia") {
            // Remover la capa de tendencia si está activa
            if (currentMap.hasLayer(trendLayer)) {
                currentMap.removeLayer(trendLayer);
            }
            trendGeoraster = null;
            layers.trendLayer = null;
            if (currentLayerType === 'Tendencia') {
                currentLayerType = null;
                currentLayerTypeRef.value = null;
            }
        }

        if (legendDiv) {
            legendDiv.innerHTML = '';
        }
    });

    // Evento de clic en el mapa para mostrar los valores de LST
    currentMap.on('click', function (event) {
        const latlng = event.latlng;

        if ((currentLayerType === 'Anual' || currentLayerType === 'Mensual') && leftGeoraster && rightGeoraster) {
            // Obtener los valores de LST de ambas capas
            let valueLeft = null;
            let valueRight = null;

            let valueArray = geoblaze.identify(leftGeoraster, [latlng.lng, latlng.lat]);
            valueLeft = (valueArray && valueArray.length > 0) ? valueArray[0] : null;

            valueArray = geoblaze.identify(rightGeoraster, [latlng.lng, latlng.lat]);
            valueRight = (valueArray && valueArray.length > 0) ? valueArray[0] : null;

            // Formatear los valores
            valueLeft = (valueLeft !== null && !isNaN(valueLeft)) ? valueLeft.toFixed(2) : 'No disponible';
            valueRight = (valueRight !== null && !isNaN(valueRight)) ? valueRight.toFixed(2) : 'No disponible';

            let labelLeft, labelRight;

            if (currentLayerType === 'Anual') {
                labelLeft = `Año ${currentLeftYear}`;
                labelRight = `Año ${currentRightYear}`;
            } else if (currentLayerType === 'Mensual') {
                labelLeft = `Mes ${currentLeftMonth}`;
                labelRight = `Mes ${currentRightMonth}`;
            } else {
                labelLeft = 'Izquierda';
                labelRight = 'Derecha';
            }

            // Crear contenido del popup
            const content = `
                <div style="text-align:center; padding:2px; background-color:#fff; font-size:10px; max-width:120px;">
                    ${labelLeft}: ${valueLeft}<br>
                    ${labelRight}: ${valueRight}
                </div>
            `;

            L.popup({ className: 'custom-popup' })
                .setLatLng(latlng)
                .setContent(content)
                .openOn(currentMap);
        } else if (currentLayerType === 'Tendencia' && trendGeoraster) {
            // Obtener el valor del píxel de tendencia
            let valueTrend = null;
            let valueArray = geoblaze.identify(trendGeoraster, [latlng.lng, latlng.lat]);
            valueTrend = (valueArray && valueArray.length > 0) ? valueArray[0] : null;

            // Redondear el valor si es un número, o marcar como 'No disponible'
            if (typeof valueTrend === 'number' && !isNaN(valueTrend)) {
                valueTrend = valueTrend.toFixed(3);
            } else {
                valueTrend = 'No disponible';
            }

            // Crear contenido del popup
            const content = `
                <div style="text-align:center; padding:2px; background-color:#fff; font-size:10px; max-width:120px;">
                    Tendencia LST: ${valueTrend}
                </div>
            `;

            L.popup({ className: 'custom-popup' })
                .setLatLng(latlng)
                .setContent(content)
                .openOn(currentMap);
        } else {
            currentMap.closePopup();
        }
    });
}
