import { loadNdviLayersyear } from './ndvi_year/funtion_ndvi/load_layer_year.js';
import { createYearSelector, positionYearSelector } from './ndvi_year/funtion_ndvi/utils_year.js';
import { loadNdviLayersmonth } from './ndvi_month/funtion_ndvi_moth/load_layer_month.js';
import { createMonthSelector, positionMonthSelector } from './ndvi_month/funtion_ndvi_moth/utils_month.js';
import { createyearLegendSVG, createmonthLegendSVG, addCenteredTitle } from './map_utilities_p.js';
import { map_trend, createSTLegendSVG } from './ndvi_trend_dev/trend.js';
import { createOpacitySlider } from '../slider_opacity.js';
import { loadinf_critica } from '../inf_critica_leaflet.js';

// Variables globales para almacenar el estado del mapa y las capas
let currentMap = null;
let leftLayer = null;
let rightLayer = null;
let sideBySideControl = null;
let legendDiv = null; // Variable global para la leyenda
let trendAdditionalTextDiv = null; // Variable global para el cuadro de texto adicional

// Variables para los georasters actuales
let leftGeoraster = null;
let rightGeoraster = null;
let trendGeoraster = null; // Nuevo: georaster para la capa de tendencia

// Variables para almacenar los años/meses actuales
let currentLayerType = null; // 'Anual', 'Mensual', 'Tendencia' o null

let currentLeftYear = "2017";
let currentRightYear = "2025";

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
    textDiv.style.top = 'calc(50% + 340px)'; // Ajusta este valor según la posición de la leyenda
    textDiv.style.left = '10px';
    textDiv.style.backgroundColor = 'white';
    textDiv.style.padding = '10px';
    textDiv.style.borderRadius = '8px';
    textDiv.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
    textDiv.style.zIndex = '1000';
    textDiv.innerHTML = content;
    return textDiv;
}



export async function map_ndvi() {
    // Elimina el mapa y la leyenda si ya están inicializados
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        leftLayer = null;
        rightLayer = null;
        sideBySideControl = null;

        // Eliminar el título del mapa
        let mapTitleDiv = document.getElementById('map-title');
        if (mapTitleDiv) {
            mapTitleDiv.remove();
            mapTitleDiv = null;
        }

        // Eliminar la leyenda si existe
        if (legendDiv) {
            legendDiv.remove();
            legendDiv = null;
        }
        const rasterNote = document.getElementById('ndvi-raster-data-notice');
        if (rasterNote) rasterNote.remove();
    }

    // Inicializar el mapa
    currentMap = L.map("p01").setView([-33.04752000, -71.44249000], 12.6);

    // Capa base de CartoDB
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
    addCenteredTitle(currentMap, "NDVI Área Urbana (píxel)");

    // Cargar capa de infraestructura crítica
    const infCriticaData = await loadinf_critica(currentMap);

    // Crear un `layerGroup` para agrupar todas las capas de infraestructura crítica
    let infCriticaLayer = null;
    if (infCriticaData && typeof infCriticaData === 'object') {
        const layersArray = Object.values(infCriticaData); // Obtener todas las capas
        infCriticaLayer = L.layerGroup(layersArray); // Crear el layerGroup con todas las capas
    } else {
        console.error("La capa de infraestructura crítica no es válida:", infCriticaData);
    }

    // Cargar las capas anuales y mensuales
    const DataYear = await loadNdviLayersyear(currentMap);
    const LayersYear = DataYear.layers;
    const GeorastersYear = DataYear.georasters;

    const DataMonth = await loadNdviLayersmonth(currentMap);
    const LayersMonth = DataMonth.layers;
    const GeorastersMonth = DataMonth.georasters;

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

    function countNdviRasterSlots(layersObj) {
        return Object.values(layersObj).filter(Boolean).length;
    }

    function syncNdviRasterNotice() {
        const n = countNdviRasterSlots(LayersYear) + countNdviRasterSlots(LayersMonth);
        let el = document.getElementById('ndvi-raster-data-notice');
        if (n === 0) {
            if (!el) {
                el = document.createElement('div');
                el.id = 'ndvi-raster-data-notice';
                el.className = 'map-raster-data-notice';
                el.setAttribute('role', 'status');
                currentMap.getContainer().appendChild(el);
            }
            el.innerHTML = `
                <span class="map-raster-data-notice__title">Sin archivos raster NDVI</span>
                <p class="map-raster-data-notice__text">El mapa píxel solo carga rutas y nombres fijos. Revise la consola (F12): verá <code>[GeoTIFF] HTTP …</code> con la URL exacta que falló.</p>
                <ul class="map-raster-data-notice__list">
                    <li><strong>Anual (composito por año):</strong> solo <code>NDVI_Yearly/NDVI_Yearly_YYYY.tif</code> (no mezclar con tendencia).</li>
                    <li><strong>Tendencia (Mann–Kendall + Sen):</strong> un solo raster <code>NDVI_Trend/NDVI_Yearly_Trend.tif</code> (en Drive la exportación va a la carpeta <code>NDVI_Trend</code>, distinta de <code>NDVI_Yearly</code>).</li>
                    <li><strong>Mensual (climatología):</strong> <code>NDVI_Monthly/NDVI_Monthly_01.tif</code> … <code>_12.tif</code>. La serie año-mes en gráficos usa CSV, no rasters YearMonth.</li>
                    <li><strong>Servidor:</strong> use HTTP (Live Server, etc.); <code>file://</code> suele bloquear los <code>fetch</code> a los .tif.</li>
                </ul>
            `;
            el.hidden = false;
        } else if (el) {
            el.hidden = true;
        }
    }

    function pickNdviYearKey(preferred) {
        const pref = `NDVI ${preferred}`;
        if (LayersYear[pref]) return preferred;
        const keys = Object.keys(LayersYear).filter((k) => LayersYear[k]).sort();
        if (!keys.length) return null;
        return keys[0].replace('NDVI ', '');
    }

    function pickNdviMonthKey(preferred) {
        const pref = `NDVI ${preferred}`;
        if (LayersMonth[pref]) return preferred;
        const keys = Object.keys(LayersMonth).filter((k) => LayersMonth[k]).sort();
        if (!keys.length) return null;
        return keys[0].replace('NDVI ', '');
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
        syncNdviRasterNotice();
        mountLegendShell();
        legendDiv.innerHTML = createyearLegendSVG();
        yearLeftSelector.style.display = 'block';
        yearRightSelector.style.display = 'block';
        const ylSel = document.getElementById('yearLeft');
        const yrSel = document.getElementById('yearRight');
        let ly = pickNdviYearKey(currentLeftYear);
        let ry = pickNdviYearKey(currentRightYear);
        if (ly && ry === ly) {
            const alt = Object.keys(LayersYear)
                .filter((k) => LayersYear[k] && k !== `NDVI ${ly}`)
                .sort();
            ry = alt.length ? alt[0].replace('NDVI ', '') : ly;
        }
        if (ly) {
            currentLeftYear = String(ly);
            if (ylSel) ylSel.value = currentLeftYear;
        }
        if (ry) {
            currentRightYear = String(ry);
            if (yrSel) yrSel.value = currentRightYear;
        }
        leftGeoraster = GeorastersYear[`NDVI ${currentLeftYear}`];
        rightGeoraster = GeorastersYear[`NDVI ${currentRightYear}`];
        leftLayer = LayersYear[`NDVI ${currentLeftYear}`];
        rightLayer = LayersYear[`NDVI ${currentRightYear}`];
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
        syncNdviRasterNotice();
        mountLegendShell();
        legendDiv.innerHTML = createmonthLegendSVG();
        monthLeftSelector.style.display = 'block';
        monthRightSelector.style.display = 'block';
        const mlSel = document.getElementById('monthLeft');
        const mrSel = document.getElementById('monthRight');
        let lm = pickNdviMonthKey(currentLeftMonth);
        let rm = pickNdviMonthKey(currentRightMonth);
        if (lm && rm === lm) {
            const alt = Object.keys(LayersMonth)
                .filter((k) => LayersMonth[k] && k !== `NDVI ${lm}`)
                .sort();
            rm = alt.length ? alt[0].replace('NDVI ', '') : lm;
        }
        if (lm) {
            currentLeftMonth = lm;
            if (mlSel) mlSel.value = lm;
        }
        if (rm) {
            currentRightMonth = rm;
            if (mrSel) mrSel.value = rm;
        }
        leftGeoraster = GeorastersMonth[`NDVI ${currentLeftMonth}`];
        rightGeoraster = GeorastersMonth[`NDVI ${currentRightMonth}`];
        leftLayer = LayersMonth[`NDVI ${currentLeftMonth}`];
        rightLayer = LayersMonth[`NDVI ${currentRightMonth}`];
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
                <p>La tendencia raster se muestra solo donde el resultado supera la máscara estadística usada en el backend (p-value <= 0.025).</p>
            `;
        trendAdditionalTextDiv = createTrendAdditionalText(additionalContent);
        currentMap.getContainer().appendChild(trendAdditionalTextDiv);
    }

    syncNdviRasterNotice();

    if (Object.keys(baseLayers).length > 0) {
        const layerControl = L.control.layers(baseLayers, overlayOnly).addTo(currentMap);
        const layerControlDiv = layerControl.getContainer();
        const layersList = layerControlDiv.querySelector('.leaflet-control-layers-list');
        const title = document.createElement('h4');
        title.innerHTML = 'NDVI — unidad de tiempo';
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
        const newLeftLayer = LayersYear[`NDVI ${selectedYear}`];
        const newLeftGeoraster = GeorastersYear[`NDVI ${selectedYear}`];
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
        const newRightLayer = LayersYear[`NDVI ${selectedYear}`];
        const newRightGeoraster = GeorastersYear[`NDVI ${selectedYear}`];
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
        const newLeftLayer = LayersMonth[`NDVI ${selectedMonth}`];
        const newLeftGeoraster = GeorastersMonth[`NDVI ${selectedMonth}`];
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
        const newRightLayer = LayersMonth[`NDVI ${selectedMonth}`];
        const newRightGeoraster = GeorastersMonth[`NDVI ${selectedMonth}`];
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
                        Tendencia NDVI: ${valueTrend}
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
