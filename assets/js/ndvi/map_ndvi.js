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
let currentRightYear = "2023";

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

    // Definir capas base y superpuestas
    const YearLayer = L.layerGroup(); // Capa vacía para el control de capas
    const MonthLayer = L.layerGroup(); // Capa vacía para el control de capas
    const trendLayerData = await map_trend(currentMap);
    const trendLayer = trendLayerData ? trendLayerData.layer : null;

    // Verificar que las capas no sean undefined
    const overlayLayers = {};

    if (YearLayer) overlayLayers["Anual"] = YearLayer;
    else console.error("YearLayer no está definido correctamente.");

    if (MonthLayer) overlayLayers["Mensual"] = MonthLayer;
    else console.error("MonthLayer no está definido correctamente.");

    if (trendLayer) overlayLayers["Tendencia"] = trendLayer;
    else console.error("trendLayer no está definido correctamente.");

    // Agregar la capa de infraestructura crítica al control de capas si está bien definida
    if (infCriticaLayer) {
        overlayLayers["Infraestructura Crítica"] = infCriticaLayer;
       
    }

    // Crear el control de capas solo si hay capas válidas
    if (Object.keys(overlayLayers).length > 0) {
        const layerControl = L.control.layers(null, overlayLayers).addTo(currentMap);

        // Personalización del control de capas
        const layerControlDiv = layerControl.getContainer();
        const layersList = layerControlDiv.querySelector('.leaflet-control-layers-list');
        const title = document.createElement('h4');
        title.innerHTML = "NDVI";
        title.classList.add('leaflet-control-title');
        const separator = document.createElement('div');
        separator.classList.add('leaflet-control-layers-separator');
        layersList.prepend(separator);
        layersList.prepend(title);
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
        document.getElementById('yearLeft').addEventListener('change', function() {
            const selectedYear = this.value;
            currentLeftYear = selectedYear;
    
            const newLeftLayer = LayersYear[`NDVI ${selectedYear}`];
            const newLeftGeoraster = GeorastersYear[`NDVI ${selectedYear}`];
    
            if (leftLayer) currentMap.removeLayer(leftLayer);
            leftLayer = newLeftLayer;
            leftGeoraster = newLeftGeoraster;
            layers.leftLayer = leftLayer; // Actualizar layers
            currentMap.addLayer(leftLayer);
    
            if (sideBySideControl) {
                sideBySideControl.setLeftLayers(leftLayer);
            }
        });
    
        document.getElementById('yearRight').addEventListener('change', function() {
            const selectedYear = this.value;
            currentRightYear = selectedYear;
    
            const newRightLayer = LayersYear[`NDVI ${selectedYear}`];
            const newRightGeoraster = GeorastersYear[`NDVI ${selectedYear}`];
    
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
        document.getElementById('monthLeft').addEventListener('change', function() {
            const selectedMonth = this.value;
            currentLeftMonth = selectedMonth;
    
            const newLeftLayer = LayersMonth[`NDVI ${selectedMonth}`];
            const newLeftGeoraster = GeorastersMonth[`NDVI ${selectedMonth}`];
    
            if (leftLayer) currentMap.removeLayer(leftLayer);
            leftLayer = newLeftLayer;
            leftGeoraster = newLeftGeoraster;
            layers.leftLayer = leftLayer; // Actualizar layers
            currentMap.addLayer(leftLayer);
    
            if (sideBySideControl) {
                sideBySideControl.setLeftLayers(leftLayer);
            }
        });
    
        document.getElementById('monthRight').addEventListener('change', function() {
            const selectedMonth = this.value;
            currentRightMonth = selectedMonth;
    
            const newRightLayer = LayersMonth[`NDVI ${selectedMonth}`];
            const newRightGeoraster = GeorastersMonth[`NDVI ${selectedMonth}`];
    
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
        currentMap.on('overlayadd', function(event) {
            // Si existe un sideBySideControl previo, eliminarlo
    if (sideBySideControl) {
        sideBySideControl.remove();
        sideBySideControl = null;
    }

    // Remover capas previas si existen
    if (leftLayer) {
        currentMap.removeLayer(leftLayer);
        leftLayer = null;
    }
    if (rightLayer) {
        currentMap.removeLayer(rightLayer);
        rightLayer = null;
    }
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
// Dentro del evento overlayadd
switch (event.name) {
    case "Anual":
        currentLayerType = 'Anual';
        currentLayerTypeRef.value = 'Anual'; 
        yearLeftSelector.style.display = 'block';
        yearRightSelector.style.display = 'block';
        monthLeftSelector.style.display = 'none';
        monthRightSelector.style.display = 'none';
        legendDiv.innerHTML = createyearLegendSVG();

        // Asignar los georasters correspondientes
        leftGeoraster = GeorastersYear[`NDVI ${currentLeftYear}`];
        rightGeoraster = GeorastersYear[`NDVI ${currentRightYear}`];

        // Añadir las capas al mapa
        leftLayer = LayersYear[`NDVI ${currentLeftYear}`];
        rightLayer = LayersYear[`NDVI ${currentRightYear}`];
        currentMap.addLayer(leftLayer);
        currentMap.addLayer(rightLayer);

        layers.leftLayer = leftLayer; // Actualizar layers
        layers.rightLayer = rightLayer;

        // Crear y agregar el nuevo control Side by Side
        sideBySideControl = L.control.sideBySide(leftLayer, rightLayer).addTo(currentMap);
        break;

    case "Mensual":
        currentLayerType = 'Mensual';
        currentLayerTypeRef.value = 'Mensual';
        monthLeftSelector.style.display = 'block';
        monthRightSelector.style.display = 'block';
        yearLeftSelector.style.display = 'none';
        yearRightSelector.style.display = 'none';
        legendDiv.innerHTML = createmonthLegendSVG();

        // Asignar los georasters correspondientes
        leftGeoraster = GeorastersMonth[`NDVI ${currentLeftMonth}`];
        rightGeoraster = GeorastersMonth[`NDVI ${currentRightMonth}`];

        // Añadir las capas al mapa
        leftLayer = LayersMonth[`NDVI ${currentLeftMonth}`];
        rightLayer = LayersMonth[`NDVI ${currentRightMonth}`];
        currentMap.addLayer(leftLayer);
        currentMap.addLayer(rightLayer);

        layers.leftLayer = leftLayer; // Actualizar layers
        layers.rightLayer = rightLayer;

        // Crear y agregar el nuevo control Side by Side
        sideBySideControl = L.control.sideBySide(leftLayer, rightLayer).addTo(currentMap);
        break;

        case "Tendencia":
            currentLayerType = 'Tendencia';
            currentLayerTypeRef.value = 'Tendencia';
            // Ocultar selectores que no son necesarios
            yearLeftSelector.style.display = 'none';
            yearRightSelector.style.display = 'none';
            monthLeftSelector.style.display = 'none';
            monthRightSelector.style.display = 'none';
            
            // Actualizar la leyenda
            legendDiv.innerHTML = createSTLegendSVG();

            // Asignar georaster de tendencia
            trendGeoraster = trendLayerData.georaster;

            // Añadir la capa de tendencia al mapa si no está ya
            if (!currentMap.hasLayer(trendLayer)) {
                currentMap.addLayer(trendLayer);
            }

            // Actualizar el objeto layers
            layers.trendLayer = trendLayer;

            // Crear y agregar el nuevo cuadro de texto adicional
            const additionalContent = `
                <p>Aunque se observan tendencias en los datos, estas no son estadísticamente significativas, ya que el valor p es mayor a 0.05.</p>
            `;
            trendAdditionalTextDiv = createTrendAdditionalText(additionalContent);
            currentMap.getContainer().appendChild(trendAdditionalTextDiv);

            break;

    // Puedes manejar otros casos aquí si es necesario
}

        });
    
        currentMap.on('overlayremove', function(event) {
            if (event.name === "Anual") {
                yearLeftSelector.style.display = 'none';
                yearRightSelector.style.display = 'none';
                if (leftLayer) currentMap.removeLayer(leftLayer);
                if (rightLayer) currentMap.removeLayer(rightLayer);
                leftLayer = null;
                rightLayer = null;
                leftGeoraster = null;
                rightGeoraster = null;
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
                if (currentLayerType === 'Tendencia') {
                    currentLayerType = null;
                    currentLayerTypeRef.value = null;
                }
        
                // Remover el cuadro de texto adicional si existe
                if (trendAdditionalTextDiv) {
                    trendAdditionalTextDiv.remove();
                    trendAdditionalTextDiv = null;
                }
            }
        
            if (legendDiv) {
                legendDiv.innerHTML = '';
            }
        });
    
        // Evento de clic en el mapa para mostrar los valores de 
        currentMap.on('click', function(event) {
            const latlng = event.latlng;
    
            if ((currentLayerType === 'Anual' || currentLayerType === 'Mensual') && leftGeoraster && rightGeoraster) {
                // Obtener los valores de  de ambas capas
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
    