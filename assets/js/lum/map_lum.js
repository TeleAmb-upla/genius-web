import { addCenteredTitle } from './map_utilities_p.js';
import { loadinf_critica } from '../inf_critica_leaflet.js';
import { attachMapOpacityPanel } from '../slider_opacity.js';

let currentMap = null;
let luminosityOverlay = null;
let droneOverlay = null;

async function loadWebpOverlay(imagePath, boundsPath) {
    try {
        const boundsResp = await fetch(resolveAssetUrl(boundsPath));
        if (!boundsResp.ok) return null;
        const imageResp = await fetch(resolveAssetUrl(imagePath), { method: 'HEAD' });
        if (!imageResp.ok) return null;
        const boundsData = await boundsResp.json();
        return L.imageOverlay(resolveAssetUrl(imagePath), boundsData.bounds, { opacity: 1 });
    } catch (error) {
        console.warn(`No se pudo cargar ${imagePath}:`, error);
        return null;
    }
}

async function loadTifOverlay(tifPath, colorFn) {
    try {
        const resp = await fetch(resolveAssetUrl(tifPath), { method: 'HEAD' });
        if (!resp.ok) return null;
        const tifResp = await fetch(resolveAssetUrl(tifPath));
        const arrayBuffer = await tifResp.arrayBuffer();
        const georaster = await parseGeoraster(arrayBuffer);
        return new GeoRasterLayer({
            georaster,
            opacity: 1,
            pixelValuesToColorFn: colorFn || function (values) {
                if (!values || values[0] === undefined || values[0] === null) return null;
                const r = values[0], g = values[1] || 0, b = values[2] || 0;
                return `rgb(${r},${g},${b})`;
            },
            resolution: 256,
        });
    } catch (error) {
        console.warn(`No se pudo cargar TIF ${tifPath}:`, error);
        return null;
    }
}

/** TIF: 1 = fuera de ámbito (transparente); 2–4 = Baja / Media / Alta (tras corrección vs. WebP). */
const CLASS_COLOR_FN = function (values) {
    const v = values[0];
    if (v === undefined || v === null || isNaN(v)) return null;
    if (v === 1) return null;
    if (v === 2) return '#000080';
    if (v === 3) return 'red';
    if (v === 4) return 'yellow';
    return null;
};

function createPillSelector(mapContainer, onSelect) {
    const wrapper = document.createElement('div');
    wrapper.className = 'lum-pill-selector';

    const pills = [
        { id: 'clasificacion', label: 'Clasificación' },
        { id: 'dron', label: 'Dron' },
    ];

    pills.forEach((pill, idx) => {
        const btn = document.createElement('button');
        btn.className = 'lum-pill' + (idx === 0 ? ' lum-pill--active' : '');
        btn.textContent = pill.label;
        btn.dataset.layer = pill.id;
        btn.addEventListener('click', () => {
            wrapper.querySelectorAll('.lum-pill').forEach(b => b.classList.remove('lum-pill--active'));
            btn.classList.add('lum-pill--active');
            onSelect(pill.id);
        });
        wrapper.appendChild(btn);
    });

    mapContainer.appendChild(wrapper);
    return wrapper;
}

export async function map_lum() {
    if (currentMap) {
        currentMap.remove();
        currentMap = null;
    }

    currentMap = L.map("p46").setView([-33.04752000, -71.44249000], 12.6);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png', {
        minZoom: 0,
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions" target="_blank">CARTO</a>'
    }).addTo(currentMap);

    L.control.scale({ metric: true, imperial: false }).addTo(currentMap);
    addCenteredTitle(currentMap);

    luminosityOverlay =
        await loadWebpOverlay(
            'assets/data/raster/Iluminacion/ILU_CLASS_RESAMPLE_1m.webp',
            'assets/data/raster/Iluminacion/illumination_class_bounds.json'
        ) ||
        await loadTifOverlay(
            'assets/data/raster/Iluminacion/ILU_CLASS_RESAMPLE_1m.tif',
            CLASS_COLOR_FN
        );

    droneOverlay =
        await loadWebpOverlay(
            'assets/data/raster/Iluminacion/M3T_RGB_QUI_2024_07.webp',
            'assets/data/raster/Iluminacion/illumination_bounds.json'
        ) ||
        await loadTifOverlay('assets/data/raster/Iluminacion/M3T_RGB_QUI_2024_07.tif');

    if (luminosityOverlay) {
        luminosityOverlay.addTo(currentMap);
        if (luminosityOverlay.getBounds) currentMap.fitBounds(luminosityOverlay.getBounds());
    }

    const mapContainer = currentMap.getContainer();

    if (luminosityOverlay && droneOverlay) {
        createPillSelector(mapContainer, (layerId) => {
            if (layerId === 'clasificacion') {
                if (!currentMap.hasLayer(luminosityOverlay)) luminosityOverlay.addTo(currentMap);
                if (currentMap.hasLayer(droneOverlay)) currentMap.removeLayer(droneOverlay);
            } else {
                if (!currentMap.hasLayer(droneOverlay)) droneOverlay.addTo(currentMap);
                if (currentMap.hasLayer(luminosityOverlay)) currentMap.removeLayer(luminosityOverlay);
            }
        });
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
        mapContainer,
        (opacity) => {
            if (luminosityOverlay && currentMap.hasLayer(luminosityOverlay)) luminosityOverlay.setOpacity(opacity);
            if (droneOverlay && currentMap.hasLayer(droneOverlay)) droneOverlay.setOpacity(opacity);
        },
        { leafletMap: currentMap },
    );

    const legendContainer = document.createElement('div');
    legendContainer.className = 'map-legend-panel info legend';

    const legendTitle = document.createElement('div');
    legendTitle.className = 'map-legend-panel__title';
    legendTitle.innerText = 'Clasificación luminosidad';
    legendContainer.appendChild(legendTitle);

    const categories = [
        { label: 'Alta', color: 'yellow' },
        { label: 'Media', color: 'red' },
        { label: 'Baja', color: '#000080' },
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

    mapContainer.appendChild(legendContainer);
}
