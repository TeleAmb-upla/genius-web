import { addCenteredTitle } from './map_utilities_p.js';
import { loadinf_critica } from '../inf_critica_leaflet.js';
import { attachMapOpacityPanel } from '../slider_opacity.js';



// Variables globales para almacenar el estado del mapa, las capas y el título
// Variables globales para almacenar el estado del mapa, las capas y el título
let currentMap = null;
let currentLayer = null;
let mapTitleDiv = null;
let geojsonLayer = null; // Mover la declaración de geojsonLayer al ámbito global
let rasterLayer = null;  // Variable para la capa raster si existe
let infCriticaLayer = null; // Variable para la capa de infraestructura crítica

let currentLayers = {}; // Objeto para almacenar las capas cargadas

export async function map_lum() {
    // Elimina el mapa si ya está inicializado
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
        currentLayers = {};  // Restablecer las capas cargadas
    }

    // Crear el mapa
    currentMap = L.map("p46").setView([-33.04752000, -71.44249000], 12.6);

    // Agregar el fondo del mapa
    const CartoDB_Positron = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);

    // Agregar la escala
    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);

    // Llamar a la función para agregar el título centrado
    addCenteredTitle(currentMap);

    // Cargar la capa GeoJSON de Luminosidad (siempre visible; infraestructura es overlay opcional)
    try {
        const response = await fetch(resolveAssetUrl('assets/data/vectores/Quilpue_Class_Smoothed.geojson'));
        const data = await response.json();

        const luminosidadLabels = {
            1: 'Transparente',
            2: 'Baja',
            3: 'Media',
            4: 'Alta'
        };

        geojsonLayer = L.geoJSON(data, {
            style: function (feature) {
                let gridcode = feature.properties.gridcode;
                let fillColor;
                let fillOpacity = 1;

                switch (gridcode) {
                    case 1:
                        fillColor = 'transparent';
                        fillOpacity = 0;
                        break;
                    case 2:
                        fillColor = '#000080';
                        break;
                    case 3:
                        fillColor = 'red';
                        break;
                    case 4:
                        fillColor = 'yellow';
                        break;
                    default:
                        fillColor = 'gray';
                }

                return {
                    color: 'transparent',
                    weight: 0,
                    fillColor: fillColor,
                    fillOpacity: fillOpacity
                };
            },
            onEachFeature: function (feature, layer) {
                if (feature.properties.gridcode !== 1) {
                    layer.on('click', function (e) {
                        const gridcode = feature.properties.gridcode;
                        const luminosidad = luminosidadLabels[gridcode] || 'Desconocida';

                        L.popup()
                            .setLatLng(e.latlng)
                            .setContent(`<strong>Luminosidad:</strong> ${luminosidad}`)
                            .openOn(currentMap);
                    });

                    layer.on('mouseover', function (e) {
                        e.target.setStyle({
                            weight: 2,
                            color: '#666',
                            fillOpacity: e.target.options.fillOpacity
                        });
                        currentMap.getContainer().style.cursor = 'pointer';
                    });

                    layer.on('mouseout', function (e) {
                        geojsonLayer.resetStyle(e.target);
                        currentMap.getContainer().style.cursor = '';
                    });
                }
            }
        }).addTo(currentMap);
    } catch (error) {
        console.error('Error al cargar el archivo GeoJSON:', error);
    }

    const infCriticaData = await loadinf_critica(currentMap);
    const overlayOnly = {};
    if (infCriticaData && typeof infCriticaData === 'object') {
        overlayOnly["Infraestructura crítica (vectores)"] = L.layerGroup(Object.values(infCriticaData));
    }
    if (Object.keys(overlayOnly).length > 0) {
        L.control.layers(null, overlayOnly).addTo(currentMap);
    }

    attachMapOpacityPanel(
        currentMap.getContainer(),
        (opacity) => {
            if (geojsonLayer) {
                geojsonLayer.setStyle({ fillOpacity: opacity });
            }
        },
        { leafletMap: currentMap },
    );

    // Agregar la leyenda al mapa
    function addLegend() {
        // Obtener el contenedor del mapa
        const mapContainer = currentMap.getContainer();

        // Crear el contenedor de la leyenda
        const legendContainer = document.createElement('div');
        legendContainer.className = 'map-legend-panel info legend';

        const legendTitle = document.createElement('div');
        legendTitle.className = 'map-legend-panel__title';
        legendTitle.innerText = 'Luminosidad';
        legendContainer.appendChild(legendTitle);

        const categories = [
            { label: 'Alta', color: 'yellow' },
            { label: 'Media', color: 'red' },
            { label: 'Baja', color: '#000080' }
        ];

        categories.forEach(category => {
            const item = document.createElement('div');
            item.className = 'map-legend-panel__row';

            const colorBox = document.createElement('span');
            colorBox.className = 'map-legend-panel__swatch';
            colorBox.style.opacity = '0.7';
            colorBox.style.backgroundColor = category.color;

            const label = document.createElement('span');
            label.className = 'map-legend-panel__label';
            label.innerText = category.label;

            item.appendChild(colorBox);
            item.appendChild(label);

            legendContainer.appendChild(item);
        });

        // Agregar la leyenda al contenedor del mapa
        mapContainer.appendChild(legendContainer);
    }

    addLegend();
}
