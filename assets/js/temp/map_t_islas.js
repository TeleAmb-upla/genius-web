import { createYearSelector, positionYearSelector } from './isla_de_calor/ultis_isla_y.js';
import { LayersControl } from './isla_de_calor/control_isla.js';
import { updateMapLayerYear_isla } from './isla_de_calor/layer_isla.js';
import { legend_isla} from './isla_de_calor/legend_isla.js';
import { attachMapOpacityPanel } from '../slider_opacity.js';
import { applyOpacityToVectorTrendLayers } from '../maplibre_opacity_util.js';

export async function map_t_islas() {
    const container = document.getElementById('p71');
    container.innerHTML = `
        <div id="before_isla" style="width: 100%; height: 100%; font-family: Arial, sans-serif; color: black;"></div>
        <div id="after_isla" style="width: 100%; height: 100%; font-family: Arial, sans-serif; color: black;"></div>
        <div id="title" class="map-title">
            Isla de Calor
        </div>
    `;

    // Inicializar mapas
    const beforeMap = new maplibregl.Map({
        container: 'before_isla',
        style: {
            version: 8,
            sources: {
                carto: {
                    type: 'raster',
                    tiles: [
                        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
                    ],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
                }
            },
            layers: [
                {
                    id: 'carto-tiles',
                    type: 'raster',
                    source: 'carto',
                    minzoom: 0,
                    maxzoom: 19
                }
            ]
        },
        center: [-71.44249000, -33.04752000],
        zoom: 12.6
    });

    const afterMap = new maplibregl.Map({
        container: 'after_isla',
        style: {
            version: 8,
            sources: {
                carto: {
                    type: 'raster',
                    tiles: [
                        'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
                    ],
                    tileSize: 256,
                    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
                }
            },
            layers: [
                {
                    id: 'carto-tiles',
                    type: 'raster',
                    source: 'carto',
                    minzoom: 0,
                    maxzoom: 19
                }
            ]
        },
        center: [-71.44249000, -33.04752000],
        zoom: 12.6
    });

    // Agregar controles de navegación y escala
    const beforeNavControl = new maplibregl.NavigationControl({ showCompass: true, showZoom: true });
    beforeMap.addControl(beforeNavControl, 'top-left');

    const afterNavControl = new maplibregl.NavigationControl({ showCompass: true, showZoom: true });
    afterMap.addControl(afterNavControl, 'top-left');

    const scaleControlBefore = new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' });
    beforeMap.addControl(scaleControlBefore, 'top-right');

    const scaleControlAfter = new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' });
    afterMap.addControl(scaleControlAfter, 'top-right');

    // Crear y posicionar selectores de años
    const yearSelectors = document.createElement('div');
    const beforeYearSelector = createYearSelector('beforeYearSelector');
    const afterYearSelector = createYearSelector('afterYearSelector');
    positionYearSelector(beforeYearSelector, 'left');
    positionYearSelector(afterYearSelector, 'right');
    yearSelectors.style.display = 'block'; // Mostrar selectores por defecto
    yearSelectors.appendChild(beforeYearSelector);
    yearSelectors.appendChild(afterYearSelector);
    container.appendChild(yearSelectors);

    // Definir la función para actualizar el modo (solo yearly)
    async function setMode(mode) {
        if (mode === 'yearly') {
            // Reiniciar selectores
            beforeYearSelector.value = '';
            afterYearSelector.value = '';

            // Agregar eventos de cambio
            beforeYearSelector.addEventListener('change', async (event) => {
                const year = event.target.value;
                if (year) {
                    await updateMapLayerYear_isla(beforeMap, 'vectorSourceBeforeYear', 'vectorLayerBeforeYear', year);
                }
            });

            afterYearSelector.addEventListener('change', async (event) => {
                const year = event.target.value;
                if (year) {
                    await updateMapLayerYear_isla(afterMap, 'vectorSourceAfterYear', 'vectorLayerAfterYear', year);
                }
            });
        }
    }

    // Crear y agregar controles
    const controls = new LayersControl(setMode);
    beforeMap.on('load', () => beforeMap.addControl(controls));
    afterMap.on('load', () => afterMap.addControl(controls));

    // Inicializar el modo por defecto
    setMode('yearly');

    // Agregar comparación lado a lado (side by side)
    if (window.compareInstance) {
        window.compareInstance.remove();
    }
    window.compareInstance = new maplibregl.Compare(beforeMap, afterMap, '#p71', {
        mousemove: false,
        orientation: 'vertical'
    });

    // Ajustar el slider para que sea interactivo
    const slider = window.compareInstance.slider;
    let isDraggingCompare = false;

    const disableTextSelection = () => document.body.classList.add('no-select');
    const enableTextSelection = () => document.body.classList.remove('no-select');

    if (slider) {
        slider.addEventListener('mousedown', () => {
            isDraggingCompare = true;
            disableTextSelection();
        });

        window.addEventListener('mouseup', () => {
            if (isDraggingCompare) {
                isDraggingCompare = false;
                enableTextSelection();
            }
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDraggingCompare) return;
            const rect = slider.parentNode.getBoundingClientRect();
            const offset = (e.clientX - rect.left) / rect.width * 100;
            slider.style.left = `${Math.max(0, Math.min(100, offset))}%`;
            window.compareInstance.setSlider(offset / 100);
        });
    }

    // Crear promesas para esperar que ambos mapas carguen
    const beforeMapLoaded = new Promise((resolve) => {
        beforeMap.on('load', resolve);
    });

    const afterMapLoaded = new Promise((resolve) => {
        afterMap.on('load', resolve);
    });

    // Esperar a que ambos mapas se carguen antes de crear el slider de opacidad
    await Promise.all([beforeMapLoaded, afterMapLoaded]);

    attachMapOpacityPanel(container, (opacity) => {
      applyOpacityToVectorTrendLayers(beforeMap, opacity);
      applyOpacityToVectorTrendLayers(afterMap, opacity);
    });
    legend_isla();

}
