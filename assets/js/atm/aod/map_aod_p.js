import { loadLayersyear } from './year/load_layer_year.js';
import { createYearSelector, positionYearSelector } from './year/utils_year.js';
import { loadLayersmonth } from './month/load_layer_month.js';
import { createMonthSelector, positionMonthSelector } from './month/utils_month.js';
import { createmonthLegendSVG, createyearLegendSVG, addCenteredTitle } from './map_utilities_p.js';
import { map_trend, createSTLegendSVG } from './aod_trend/trend.js';
import { createOpacitySlider } from '../../slider_opacity.js';
import { loadinf_critica } from '../inf_critica_leaflet.js';
import { LayersControl } from '../../control.js';
import { getDefaultYearPair } from '../../map_data_catalog.js';

let currentMap = null;
let leftLayer = null;
let rightLayer = null;
let sideBySideControl = null;
let legendDiv = null;

let leftGeoraster = null;
let rightGeoraster = null;
let trendGeoraster = null;

let currentLayerType = null;

const [_defaultLeft, _defaultRight] = getDefaultYearPair('aod');
let currentLeftYear = _defaultLeft || "2024";
let currentRightYear = _defaultRight || "2025";

let currentLeftMonth = "01";
let currentRightMonth = "12";

let currentLayerTypeRef = { value: null };

let layers = {
    leftLayer: null,
    rightLayer: null,
    trendLayer: null
};

export async function map_aod_p() {
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        leftLayer = null;
        rightLayer = null;
        sideBySideControl = null;

        let mapTitleDiv = document.getElementById('map-title');
        if (mapTitleDiv) {
            mapTitleDiv.remove();
        }

        if (legendDiv) {
            legendDiv.remove();
            legendDiv = null;
        }
    }

    currentMap = L.map("p19").setView([-33.04752000, -71.44249000], 10.9);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);

    L.control.scale({
        position: 'topright',
        metric: true,
        imperial: false
    }).addTo(currentMap);

    addCenteredTitle(currentMap, "AOD Área Regional (píxel)");

    const infCriticaData = await loadinf_critica(currentMap);
    let infCriticaLayer = null;
    if (infCriticaData && typeof infCriticaData === 'object') {
        const layersArray = Object.values(infCriticaData);
        infCriticaLayer = L.layerGroup(layersArray);
    } else {
        console.error("La capa de infraestructura crítica no es válida:", infCriticaData);
    }

    const DataYear = await loadLayersyear(currentMap);
    const LayersYear = DataYear.layers;
    const GeorastersYear = DataYear.georasters;

    const DataMonth = await loadLayersmonth(currentMap);
    const LayersMonth = DataMonth.layers;
    const GeorastersMonth = DataMonth.georasters;

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

    const trendLayerData = await map_trend(currentMap);
    const trendLayer = trendLayerData ? trendLayerData.layer : null;

    function mountLegendShell() {
        if (legendDiv && legendDiv.parentNode) return;
        legendDiv = document.createElement('div');
        legendDiv.id = 'legend';
        legendDiv.className = 'map-legend-panel';
        currentMap.getContainer().appendChild(legendDiv);
    }

    function cleanupTemporalRasters() {
        if (sideBySideControl) {
            sideBySideControl.remove();
            sideBySideControl = null;
        }
        if (leftLayer) {
            try { currentMap.removeLayer(leftLayer); } catch (e) { /* noop */ }
            leftLayer = null;
        }
        if (rightLayer) {
            try { currentMap.removeLayer(rightLayer); } catch (e) { /* noop */ }
            rightLayer = null;
        }
        if (trendLayer && currentMap.hasLayer(trendLayer)) {
            currentMap.removeLayer(trendLayer);
        }
        leftGeoraster = null;
        rightGeoraster = null;
        trendGeoraster = null;
        yearLeftSelector.style.display = 'none';
        yearRightSelector.style.display = 'none';
        monthLeftSelector.style.display = 'none';
        monthRightSelector.style.display = 'none';
    }

    function activateAnualMode() {
        cleanupTemporalRasters();
        currentLayerType = 'Anual';
        currentLayerTypeRef.value = 'Anual';
        mountLegendShell();
        legendDiv.innerHTML = createyearLegendSVG();
        yearLeftSelector.style.display = 'block';
        yearRightSelector.style.display = 'block';
        leftGeoraster = GeorastersYear[`AOD ${currentLeftYear}`];
        rightGeoraster = GeorastersYear[`AOD ${currentRightYear}`];
        leftLayer = LayersYear[`AOD ${currentLeftYear}`];
        rightLayer = LayersYear[`AOD ${currentRightYear}`];
        if (leftLayer) currentMap.addLayer(leftLayer);
        if (rightLayer) currentMap.addLayer(rightLayer);
        layers.leftLayer = leftLayer;
        layers.rightLayer = rightLayer;
        layers.trendLayer = trendLayer;
        if (leftLayer && rightLayer) {
            sideBySideControl = L.control.sideBySide(leftLayer, rightLayer).addTo(currentMap);
        }
    }

    function activateMensualMode() {
        cleanupTemporalRasters();
        currentLayerType = 'Mensual';
        currentLayerTypeRef.value = 'Mensual';
        mountLegendShell();
        legendDiv.innerHTML = createmonthLegendSVG();
        monthLeftSelector.style.display = 'block';
        monthRightSelector.style.display = 'block';
        leftGeoraster = GeorastersMonth[`AOD ${currentLeftMonth}`];
        rightGeoraster = GeorastersMonth[`AOD ${currentRightMonth}`];
        leftLayer = LayersMonth[`AOD ${currentLeftMonth}`];
        rightLayer = LayersMonth[`AOD ${currentRightMonth}`];
        if (leftLayer) currentMap.addLayer(leftLayer);
        if (rightLayer) currentMap.addLayer(rightLayer);
        layers.leftLayer = leftLayer;
        layers.rightLayer = rightLayer;
        layers.trendLayer = trendLayer;
        if (leftLayer && rightLayer) {
            sideBySideControl = L.control.sideBySide(leftLayer, rightLayer).addTo(currentMap);
        }
    }

    function activateTendenciaMode() {
        if (!trendLayer) return;
        cleanupTemporalRasters();
        currentLayerType = 'Tendencia';
        currentLayerTypeRef.value = 'Tendencia';
        mountLegendShell();
        legendDiv.innerHTML = createSTLegendSVG();
        trendGeoraster = trendLayerData.georaster;
        currentMap.addLayer(trendLayer);
        layers.trendLayer = trendLayer;
        layers.leftLayer = null;
        layers.rightLayer = null;
    }

    const controls = new LayersControl(
        (mode) => {
            if (mode === 'yearly') activateAnualMode();
            else if (mode === 'monthly') activateMensualMode();
            else if (mode === 'trend') activateTendenciaMode();
        },
        (enabled) => {
            if (!infCriticaLayer) return;
            if (enabled) infCriticaLayer.addTo(currentMap);
            else currentMap.removeLayer(infCriticaLayer);
        }
    );
    controls._container.style.position = 'absolute';
    controls._container.style.top = '10px';
    controls._container.style.right = '10px';
    controls._container.style.zIndex = '1000';
    currentMap.getContainer().appendChild(controls._container);

    layers.leftLayer = leftLayer;
    layers.rightLayer = rightLayer;
    layers.trendLayer = trendLayer;

    await createOpacitySlider(currentMap, layers, currentLayerTypeRef);

    currentLayerType = null;
    controls.setMode('yearly');

    document.getElementById('yearLeft').addEventListener('change', function () {
        if (currentLayerType !== 'Anual') return;
        const selectedYear = this.value;
        currentLeftYear = selectedYear;
        const newLeftLayer = LayersYear[`AOD ${selectedYear}`];
        const newLeftGeoraster = GeorastersYear[`AOD ${selectedYear}`];
        if (!newLeftLayer) return;
        if (leftLayer) currentMap.removeLayer(leftLayer);
        leftLayer = newLeftLayer;
        leftGeoraster = newLeftGeoraster;
        layers.leftLayer = leftLayer;
        currentMap.addLayer(leftLayer);
        if (sideBySideControl) {
            sideBySideControl.setLeftLayers(leftLayer);
        }
    });

    document.getElementById('yearRight').addEventListener('change', function () {
        if (currentLayerType !== 'Anual') return;
        const selectedYear = this.value;
        currentRightYear = selectedYear;
        const newRightLayer = LayersYear[`AOD ${selectedYear}`];
        const newRightGeoraster = GeorastersYear[`AOD ${selectedYear}`];
        if (!newRightLayer) return;
        if (rightLayer) currentMap.removeLayer(rightLayer);
        rightLayer = newRightLayer;
        rightGeoraster = newRightGeoraster;
        layers.rightLayer = rightLayer;
        currentMap.addLayer(rightLayer);
        if (sideBySideControl) {
            sideBySideControl.setRightLayers(rightLayer);
        }
    });

    document.getElementById('monthLeft').addEventListener('change', function () {
        if (currentLayerType !== 'Mensual') return;
        const selectedMonth = this.value;
        currentLeftMonth = selectedMonth;
        const newLeftLayer = LayersMonth[`AOD ${selectedMonth}`];
        const newLeftGeoraster = GeorastersMonth[`AOD ${selectedMonth}`];
        if (!newLeftLayer) return;
        if (leftLayer) currentMap.removeLayer(leftLayer);
        leftLayer = newLeftLayer;
        leftGeoraster = newLeftGeoraster;
        layers.leftLayer = leftLayer;
        currentMap.addLayer(leftLayer);
        if (sideBySideControl) {
            sideBySideControl.setLeftLayers(leftLayer);
        }
    });

    document.getElementById('monthRight').addEventListener('change', function () {
        if (currentLayerType !== 'Mensual') return;
        const selectedMonth = this.value;
        currentRightMonth = selectedMonth;
        const newRightLayer = LayersMonth[`AOD ${selectedMonth}`];
        const newRightGeoraster = GeorastersMonth[`AOD ${selectedMonth}`];
        if (!newRightLayer) return;
        if (rightLayer) currentMap.removeLayer(rightLayer);
        rightLayer = newRightLayer;
        rightGeoraster = newRightGeoraster;
        layers.rightLayer = rightLayer;
        currentMap.addLayer(rightLayer);
        if (sideBySideControl) {
            sideBySideControl.setRightLayers(rightLayer);
        }
    });

    currentMap.on('click', function (event) {
        const latlng = event.latlng;

        if ((currentLayerType === 'Anual' || currentLayerType === 'Mensual') && leftGeoraster && rightGeoraster) {
            let valueLeft = null;
            let valueRight = null;

            let valueArray = geoblaze.identify(leftGeoraster, [latlng.lng, latlng.lat]);
            valueLeft = (valueArray && valueArray.length > 0) ? valueArray[0] : null;

            valueArray = geoblaze.identify(rightGeoraster, [latlng.lng, latlng.lat]);
            valueRight = (valueArray && valueArray.length > 0) ? valueArray[0] : null;

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

            const content = `
                    <div style="text-align:center; padding:2px; background-color:#fff; font-size:10px; max-width:120px;">
                        ${labelLeft}: ${valueLeft}<br>
                        ${labelRight}: ${valueRight}
                    </div>
                `;

            L.popup({ className: 'geo-popup' })
                .setLatLng(latlng)
                .setContent(content)
                .openOn(currentMap);
        } else if (currentLayerType === 'Tendencia' && trendGeoraster) {
            let valueTrend = null;
            let valueArray = geoblaze.identify(trendGeoraster, [latlng.lng, latlng.lat]);
            valueTrend = (valueArray && valueArray.length > 0) ? valueArray[0] : null;

            if (typeof valueTrend === 'number' && !isNaN(valueTrend)) {
                valueTrend = valueTrend.toFixed(3);
            } else {
                valueTrend = 'No disponible';
            }

            const content = `
                    <div style="text-align:center; padding:2px; background-color:#fff; font-size:10px; max-width:120px;">
                        Tendencia AOD: ${valueTrend}
                    </div>
                `;

            L.popup({ className: 'geo-popup' })
                .setLatLng(latlng)
                .setContent(content)
                .openOn(currentMap);
        } else {
            currentMap.closePopup();
        }
    });
}
