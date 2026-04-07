import { loadLayersyear } from './year/load_layer_year.js';
import { createYearSelector, positionYearSelector } from './year/utils_year.js';
import { loadLayersmonth } from './month/load_layer_month.js';
import { createMonthSelector, positionMonthSelector } from './month/utils_month.js';
import { createmonthLegendSVG, createyearLegendSVG, addCenteredTitle } from './map_utilities_p.js';
import { map_trend, createSTLegendSVG } from './so2_trend/trend.js';
import { createOpacitySlider } from '../../slider_opacity.js';
import { loadinf_critica } from '../inf_critica_leaflet.js';

let currentMap = null;
let leftLayer = null;
let rightLayer = null;
let sideBySideControl = null;
let legendDiv = null;
let trendAdditionalTextDiv = null;

let leftGeoraster = null;
let rightGeoraster = null;
let trendGeoraster = null;

let currentLayerType = null;

let currentLeftYear = "2019";
let currentRightYear = "2024";

let currentLeftMonth = "01";
let currentRightMonth = "12";

let currentLayerTypeRef = { value: null };

let layers = {
    leftLayer: null,
    rightLayer: null,
    trendLayer: null
};

function createTrendAdditionalText(content) {
    const textDiv = document.createElement('div');
    textDiv.id = 'trend-additional-text';
    textDiv.style.position = 'absolute';
    textDiv.style.top = 'calc(50% + 340px)';
    textDiv.style.left = '10px';
    textDiv.style.backgroundColor = 'white';
    textDiv.style.padding = '10px';
    textDiv.style.borderRadius = '8px';
    textDiv.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
    textDiv.style.zIndex = '1000';
    textDiv.innerHTML = content;
    return textDiv;
}

export async function map_so2_p() {
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

    currentMap = L.map("p37").setView([-33.04752000, -71.44249000], 10.9);

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

    addCenteredTitle(currentMap, "SO<sub>2</sub> Área Urbana (píxel)");

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

    const YearLayer = L.layerGroup();
    const MonthLayer = L.layerGroup();
    const trendLayerData = await map_trend(currentMap);
    const trendLayer = trendLayerData ? trendLayerData.layer : null;
    const TrendSlot = L.layerGroup();

    const baseLayers = { "Año": YearLayer, "Mes": MonthLayer };
    if (trendLayer) {
        baseLayers["Tendencia"] = TrendSlot;
    }

    const overlayOnly = {};
    if (infCriticaLayer) {
        overlayOnly["Infraestructura crítica (vectores)"] = infCriticaLayer;
    }

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
        if (trendAdditionalTextDiv) {
            trendAdditionalTextDiv.remove();
            trendAdditionalTextDiv = null;
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
        leftGeoraster = GeorastersYear[`SO² ${currentLeftYear}`];
        rightGeoraster = GeorastersYear[`SO² ${currentRightYear}`];
        leftLayer = LayersYear[`SO² ${currentLeftYear}`];
        rightLayer = LayersYear[`SO² ${currentRightYear}`];
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
        leftGeoraster = GeorastersMonth[`SO² ${currentLeftMonth}`];
        rightGeoraster = GeorastersMonth[`SO² ${currentRightMonth}`];
        leftLayer = LayersMonth[`SO² ${currentLeftMonth}`];
        rightLayer = LayersMonth[`SO² ${currentRightMonth}`];
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
        const additionalContent = `
                <p>El análisis de los datos revela tendencias aparentes; sin embargo no se observan significancias estadísticas (p-value 0.05).</p>
            `;
        trendAdditionalTextDiv = createTrendAdditionalText(additionalContent);
        currentMap.getContainer().appendChild(trendAdditionalTextDiv);
    }

    if (Object.keys(baseLayers).length > 0) {
        const layerControl = L.control.layers(baseLayers, overlayOnly).addTo(currentMap);
        const layerControlDiv = layerControl.getContainer();
        const layersList = layerControlDiv.querySelector('.leaflet-control-layers-list');
        const title = document.createElement('h4');
        title.innerHTML = 'SO₂ — unidad de tiempo';
        title.classList.add('leaflet-control-title');
        const separator = document.createElement('div');
        separator.classList.add('leaflet-control-layers-separator');
        layersList.prepend(separator);
        layersList.prepend(title);
    }

    layers.leftLayer = leftLayer;
    layers.rightLayer = rightLayer;
    layers.trendLayer = trendLayer;

    await createOpacitySlider(currentMap, layers, currentLayerTypeRef);

    currentLayerType = null;

    currentMap.on('baselayerchange', function (e) {
        if (e.layer === YearLayer) activateAnualMode();
        else if (e.layer === MonthLayer) activateMensualMode();
        else if (e.layer === TrendSlot) activateTendenciaMode();
    });

    currentMap.addLayer(YearLayer);
    activateAnualMode();

    document.getElementById('yearLeft').addEventListener('change', function () {
        if (currentLayerType !== 'Anual') return;
        const selectedYear = this.value;
        currentLeftYear = selectedYear;
        const newLeftLayer = LayersYear[`SO² ${selectedYear}`];
        const newLeftGeoraster = GeorastersYear[`SO² ${selectedYear}`];
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
        const newRightLayer = LayersYear[`SO² ${selectedYear}`];
        const newRightGeoraster = GeorastersYear[`SO² ${selectedYear}`];
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
        const newLeftLayer = LayersMonth[`SO² ${selectedMonth}`];
        const newLeftGeoraster = GeorastersMonth[`SO² ${selectedMonth}`];
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
        const newRightLayer = LayersMonth[`SO² ${selectedMonth}`];
        const newRightGeoraster = GeorastersMonth[`SO² ${selectedMonth}`];
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

            L.popup({ className: 'custom-popup' })
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
                        Tendencia SO²: ${valueTrend}
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
