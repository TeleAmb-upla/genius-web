import { loadLayersyear } from './year/load_layer_year.js';
import { createYearSelector, positionYearSelector } from './year/utils_year.js';
import { loadLayersmonth } from './month/load_layer_month.js';
import { createMonthSelector, positionMonthSelector } from './month/utils_month.js';
import { createmonthLegendSVG, createyearLegendSVG ,addCenteredTitle } from './map_utilities_p.js';
import { map_trend, createSTLegendSVG } from './so2_trend/trend.js';
import { createOpacitySlider } from '../slider_opacity.js';
import { loadinf_critica } from '../inf_critica_leaflet.js';

// Variables globales
let currentMap = null;
let leftLayer = null;
let rightLayer = null;
let sideBySideControl = null;
let legendDiv = null; // Variable global para la leyenda
let trendAdditionalTextDiv = null; // Variable global para el cuadro de texto adicional

let leftGeoraster = null;
let rightGeoraster = null;
let trendGeoraster = null;

let currentLayerType = null; // 'Anual', 'Mensual', 'Tendencia' o null

let currentLeftYear = "2019";
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

export async function map_so2_p() {
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
        }

        // Eliminar la leyenda si existe
        if (legendDiv) {
            legendDiv.remove();
            legendDiv = null;
        }
    }


    // Crear el mapa
    currentMap = L.map("p37").setView([-33.04752000, -71.44249000], 10.9);

    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);
        
 // Agregar escala métrica en la esquina superior derecha
 L.control.scale({
    position: 'topright', // Posición deseada
    metric: true,
    imperial: false
  }).addTo(currentMap);
  
   

// Actualizar el título del mapa
addCenteredTitle(currentMap, "SO<sub>2</sub> Área Urbana (píxel)");



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
        const DataYear = await loadLayersyear(currentMap);
        const LayersYear = DataYear.layers;
        const GeorastersYear = DataYear.georasters;
    
        const DataMonth = await loadLayersmonth(currentMap);
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
    
            // Obtener el div del control de capas
            const layerControlDiv = layerControl.getContainer();
    
            // Obtener la lista de capas
            const layersList = layerControlDiv.querySelector('.leaflet-control-layers-list');
    
            // Crear el título 
            const title = document.createElement('h4');
            title.innerHTML = "SO<sub>2</sub>"; // Texto del título
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
        document.getElementById('yearLeft').addEventListener('change', function() {
            const selectedYear = this.value;
            currentLeftYear = selectedYear;
    
            const newLeftLayer = LayersYear[`SO² ${selectedYear}`];
            const newLeftGeoraster = GeorastersYear[`SO² ${selectedYear}`];
    
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
    
            const newRightLayer = LayersYear[`SO² ${selectedYear}`];
            const newRightGeoraster = GeorastersYear[`SO² ${selectedYear}`];
    
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
    
            const newLeftLayer = LayersMonth[`SO² ${selectedMonth}`];
            const newLeftGeoraster = GeorastersMonth[`SO² ${selectedMonth}`];
    
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
    
            const newRightLayer = LayersMonth[`SO² ${selectedMonth}`];
            const newRightGeoraster = GeorastersMonth[`SO² ${selectedMonth}`];
    
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
            // Eliminar la leyenda previa si existe
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
                legendDiv = null;
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
                    currentLayerTypeRef.value = 'Anual'; 
                    yearLeftSelector.style.display = 'block';
                    yearRightSelector.style.display = 'block';
                    monthLeftSelector.style.display = 'none';
                    monthRightSelector.style.display = 'none';
                    legendDiv.innerHTML = createyearLegendSVG();
    
                    // Asignar los georasters correspondientes
                    leftGeoraster = GeorastersYear[`SO² ${currentLeftYear}`];
                    rightGeoraster = GeorastersYear[`SO² ${currentRightYear}`];
    
                    // Añadir las capas al mapa
                    leftLayer = LayersYear[`SO² ${currentLeftYear}`];
                    rightLayer = LayersYear[`SO² ${currentRightYear}`];
                    currentMap.addLayer(leftLayer);
                    currentMap.addLayer(rightLayer);

                    layers.leftLayer = leftLayer; // Actualizar layers
                    layers.rightLayer = rightLayer;

                    // Agregar el control Side by Side
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
                    leftGeoraster = GeorastersMonth[`SO² ${currentLeftMonth}`];
                    rightGeoraster = GeorastersMonth[`SO² ${currentRightMonth}`];
    
                    // Añadir las capas al mapa
                    leftLayer = LayersMonth[`SO² ${currentLeftMonth}`];
                    rightLayer = LayersMonth[`SO² ${currentRightMonth}`];
                    currentMap.addLayer(leftLayer);
                    currentMap.addLayer(rightLayer);
    
                    layers.leftLayer = leftLayer; // Actualizar layers
                    layers.rightLayer = rightLayer;
    
                    // Agregar el control Side by Side
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
                            <p>El análisis de los datos revela tendencias aparentes; sin embargo no se observan significancias estadísticas (p-value 0.05).</p>
                        `;
                        trendAdditionalTextDiv = createTrendAdditionalText(additionalContent);
                        currentMap.getContainer().appendChild(trendAdditionalTextDiv);
            
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
    