// Importar funciones desde otros módulos
import { loadGeoJSONAndSetupLayers, createAvSelector, positionAvSelector } from './capas/utilis_select_av.js';
import { map_stdev, createDevLegendSVG } from './ndvi_trend_dev/stddev.js'; // Ajusta la ruta según tu estructura de carpetas


// Variables globales para almacenar el estado del mapa y las capas
let currentMap = null;
let avSelector = null;
let categoryLayers = {};
let legendDiv = null; // Variable global para la leyenda
let stdevGeoraster = null; // Variable para almacenar el georaster

export async function map_ndvi_stdev() {
    // Si el mapa ya existe, remuévelo y limpia las variables
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        avSelector = null;
        categoryLayers = {};
        legendDiv = null;
        stdevGeoraster = null;
    }

    // Inicializar el mapa
    currentMap = L.map("p67").setView([-33.04752000, -71.44249000], 12.6);

    // Capa base de CartoDB
    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }).addTo(currentMap);

    // Agregar escala métrica
    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);

    // Cargar y configurar las capas GeoJSON
    categoryLayers = await loadGeoJSONAndSetupLayers(currentMap);

    // Crear el selector de capas de áreas verdes
    avSelector = createAvSelector('av-selector', categoryLayers, currentMap);
    positionAvSelector(avSelector, 'top-right'); // Posicionar en la parte superior derecha

    // Cargar y agregar la capa raster de desviación estándar
    const rasterData = await map_stdev(currentMap);
    stdevGeoraster = rasterData.georaster; // Guardar el georaster
    rasterData.layer.addTo(currentMap);

    // Crear y agregar la leyenda del raster en centro-izquierda
    addCustomLegend(currentMap, createDevLegendSVG());

    // Añadir evento de clic para mostrar el valor del raster
    currentMap.on('click', function(event) {
        const latlng = event.latlng;
        let valueArray = geoblaze.identify(stdevGeoraster, [latlng.lng, latlng.lat]);
        let value = (valueArray && valueArray.length > 0) ? valueArray[0] : null;

        value = (value !== null && !isNaN(value)) ? value.toFixed(2) : 'No disponible';

        const content = `
            <div style="text-align:center; padding:2px; background-color:#fff; font-size:10px; max-width:120px;">
                Desviación Estándar: ${value}
            </div>
        `;

        L.popup({ className: 'custom-popup' })
            .setLatLng(latlng)
            .setContent(content)
            .openOn(currentMap);
    });
}

// Función para crear y posicionar una leyenda personalizada en centro-izquierda
function addCustomLegend(map, legendHTML) {
    // Crear un div para la leyenda
    legendDiv = L.DomUtil.create('div', 'custom-legend');
    legendDiv.innerHTML = legendHTML;

    // Añadir el div al contenedor del mapa
    map.getContainer().appendChild(legendDiv);

    // Aplicar estilos CSS para posicionar la leyenda en centro-izquierda
    Object.assign(legendDiv.style, {
        position: 'absolute',
        top: '50%', // Centrar verticalmente
        left: '10px', // A 10px del borde izquierdo
        transform: 'translateY(-50%)', // Ajustar para centrar
        background: 'rgba(255, 255, 255, 0.8)',
        padding: '10px',
        borderRadius: '8px',
        boxShadow: '0 0 15px rgba(0,0,0,0.2)',
        zIndex: '1000'
    });
}
