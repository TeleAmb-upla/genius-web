import { createYearSelector, positionYearSelector } from './isla_de_calor/ultis_isla_y.js';
import { LayersControl } from '../control.js';
import { mountLayersControlForExplorer } from '../genius_layers_control_mount.js';
import { updateMapLayerYear_isla } from './isla_de_calor/layer_isla.js';
import { legend_isla} from './isla_de_calor/legend_isla.js';
import { attachMapOpacityPanel } from '../slider_opacity.js';
import { applyOpacityToVectorTrendLayers } from '../maplibre_opacity_util.js';
import { getDefaultYearPair, getProductYears, geniusTitleForProduct, mountGeniusMapTitleElement } from '../map_data_catalog.js';
import { GENIUS_ZOOM_URBAN, applyGeniusMapLibreInteraction } from '../map_interaction_defaults.js';

async function suhiGeoJsonExists(year) {
    try {
        const response = await fetch(
            resolveAssetUrl(`assets/data/geojson/LST/LST_SUHI_Yearly/LST_SUHI_Yearly_${year}.geojson`),
            { method: 'HEAD' }
        );
        return response.ok;
    } catch (_error) {
        return false;
    }
}

async function pickClosestAvailableSuhiYear(preferredYear, fallbackYears) {
    for (const year of fallbackYears) {
        if (String(year) !== String(preferredYear) && year > Number(preferredYear)) {
            continue;
        }
        if (await suhiGeoJsonExists(year)) {
            return String(year);
        }
    }
    for (const year of fallbackYears) {
        if (await suhiGeoJsonExists(year)) {
            return String(year);
        }
    }
    return String(preferredYear);
}

export async function map_t_islas() {
    const mapTitleText = geniusTitleForProduct(
        'Islas de calor — comparar años',
        'lst',
    );
    const container = document.getElementById('p71');
    container.innerHTML = `
        <div id="before_isla" style="width: 100%; height: 100%; font-family: Arial, sans-serif; color: black;"></div>
        <div id="after_isla" style="width: 100%; height: 100%; font-family: Arial, sans-serif; color: black;"></div>
        <div id="title" class="map-title"></div>
    `;
    mountGeniusMapTitleElement(container.querySelector('#title'), mapTitleText, { temporalTitle: true });

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
        zoom: GENIUS_ZOOM_URBAN
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
        zoom: GENIUS_ZOOM_URBAN
    });


    applyGeniusMapLibreInteraction(beforeMap);


    applyGeniusMapLibreInteraction(afterMap);

    // Agregar controles de navegación y escala
    const beforeNavControl = new maplibregl.NavigationControl({ showCompass: false, showZoom: true });
    beforeMap.addControl(beforeNavControl, 'top-left');

const scaleControlBefore = new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' });
    beforeMap.addControl(scaleControlBefore, 'bottom-right');

    const scaleControlAfter = new maplibregl.ScaleControl({ maxWidth: 100, unit: 'metric' });
    afterMap.addControl(scaleControlAfter, 'bottom-right');

    const [defaultBefore, defaultAfter] = getDefaultYearPair('lst');
    const lstYearsDesc = [...getProductYears('lst')].sort((a, b) => b - a);
    const resolvedAfterYear = await pickClosestAvailableSuhiYear(defaultAfter, lstYearsDesc);
    const resolvedBeforeYear = await pickClosestAvailableSuhiYear(
        defaultBefore,
        lstYearsDesc.filter((year) => String(year) !== resolvedAfterYear)
    );

    const yearSelectors = document.createElement('div');
    const beforeYearSelector = createYearSelector('beforeYearSelector');
    const afterYearSelector = createYearSelector('afterYearSelector');
    positionYearSelector(beforeYearSelector, 'left');
    positionYearSelector(afterYearSelector, 'right');
    yearSelectors.appendChild(beforeYearSelector);
    yearSelectors.appendChild(afterYearSelector);
    container.appendChild(yearSelectors);

    const beforeSelect = beforeYearSelector.querySelector('select') || beforeYearSelector;
    const afterSelect = afterYearSelector.querySelector('select') || afterYearSelector;

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

    const controls = new LayersControl(
        (mode) => {
            yearSelectors.style.display = mode === 'yearly' ? 'block' : 'none';
        },
        {
            hideModePills: true,
            modes: [{ key: 'yearly', label: 'Anual' }],
        }
    );
    mountLayersControlForExplorer(controls, container, { zIndex: '10' });

    controls.setMode('yearly');

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

    await Promise.all([beforeMapLoaded, afterMapLoaded]);

    if (resolvedBeforeYear) {
        beforeSelect.value = resolvedBeforeYear;
        await updateMapLayerYear_isla(beforeMap, 'vectorSourceBeforeYear', 'vectorLayerBeforeYear', resolvedBeforeYear);
    }
    if (resolvedAfterYear) {
        afterSelect.value = resolvedAfterYear;
        await updateMapLayerYear_isla(afterMap, 'vectorSourceAfterYear', 'vectorLayerAfterYear', resolvedAfterYear);
    }

    attachMapOpacityPanel(container, (opacity) => {
      applyOpacityToVectorTrendLayers(beforeMap, opacity);
      applyOpacityToVectorTrendLayers(afterMap, opacity);
    });
    legend_isla();

}
