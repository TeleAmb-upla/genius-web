import { createYearSelector, positionYearSelector } from './temp_z_b/utils_z_b_y.js';
import { createMonthSelector, positionMonthSelector } from './temp_z_b/utils_z_b_m.js';
import { LayersControl } from '../control.js';
import { updateMapLayerYear, updateMapLayerMonth } from './temp_z_b/layer_z_b.js';
import { createYearLegend, createMonthLegend } from './temp_z_b/legend.js';

export async function map_t_zonal_b() {
  
  const container = document.getElementById('p13');
  container.innerHTML = `
    <div id="before_b_lst" style="width: 100%; height: 100%;"></div>
    <div id="after_b_lst" style="width: 100%; height: 100%;"></div>
    <div id="title" style="position: absolute; top: 10px; left: 50%; transform: translateX(-50%); background-color: rgba(255, 255, 255, 0.8); padding: 5px 10px; z-index: 2;">
      LST ZONAL BARRIOS
    </div>
  `;

  const beforeMap = new maplibregl.Map({
    container: 'before_b_lst', // Contenedor ajustado a 'before_b_lst'
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
    container: 'after_b_lst', // Contenedor ajustado a 'after_b_lst'
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

  // Agregar controles de navegación a la izquierda
  const beforeNavControl = new maplibregl.NavigationControl({ showCompass: true, showZoom: true });
  beforeMap.addControl(beforeNavControl, 'top-left');

  const afterNavControl = new maplibregl.NavigationControl({ showCompass: true, showZoom: true });
  afterMap.addControl(afterNavControl, 'top-left');

  // Crear y posicionar selectores de años y meses
  const yearSelectors = document.createElement('div');
  const beforeYearSelector = createYearSelector('beforeYearSelector');
  const afterYearSelector = createYearSelector('afterYearSelector');
  positionYearSelector(beforeYearSelector, 'left');
  positionYearSelector(afterYearSelector, 'right');
  yearSelectors.style.display = 'none'; // Ocultar inicialmente
  yearSelectors.appendChild(beforeYearSelector);
  yearSelectors.appendChild(afterYearSelector);
  container.appendChild(yearSelectors);

  const monthSelectors = document.createElement('div');
  const beforeMonthSelector = createMonthSelector('beforeMonthSelector');
  const afterMonthSelector = createMonthSelector('afterMonthSelector');
  positionMonthSelector(beforeMonthSelector, 'left');
  positionMonthSelector(afterMonthSelector, 'right');
  monthSelectors.style.display = 'none'; // Ocultar inicialmente
  monthSelectors.appendChild(beforeMonthSelector);
  monthSelectors.appendChild(afterMonthSelector);
  container.appendChild(monthSelectors);

  const yearLegend = createYearLegend();
  const monthLegend = createMonthLegend();
  yearLegend.style.display = 'none';
  monthLegend.style.display = 'none';
  container.appendChild(yearLegend);
  container.appendChild(monthLegend);

  function removeAllLayers(map) {
    const layers = map.getStyle().layers;
    if (!layers) return;

    layers.forEach((layer) => {
      if (layer.id.startsWith('vectorLayer')) {
        // Remover eventos de la capa
        map.off('click', layer.id);
        map.off('mouseenter', layer.id);
        map.off('mouseleave', layer.id);
        // Remover la capa del mapa
        map.removeLayer(layer.id);
      }
    });

    const sources = Object.keys(map.getStyle().sources);
    sources.forEach((source) => {
      if (source.startsWith('vectorSource')) {
        map.removeSource(source);
      }
    });
  }

  function setMode(mode) {
    // Remover todas las capas y fuentes del modo anterior
    removeAllLayers(beforeMap);
    removeAllLayers(afterMap);

    // Mostrar/ocultar los selectores y leyendas según el modo
    yearSelectors.style.display = mode === 'yearly' ? 'block' : 'none';
    monthSelectors.style.display = mode === 'yearly' ? 'none' : 'block';
    yearLegend.style.display = mode === 'yearly' ? 'block' : 'none';
    monthLegend.style.display = mode === 'yearly' ? 'none' : 'block';

    // Reiniciar los selectores para evitar selecciones inconsistentes
    beforeYearSelector.value = '';
    afterYearSelector.value = '';
    beforeMonthSelector.value = '';
    afterMonthSelector.value = '';
  }

  const controls = new LayersControl(setMode);
  beforeMap.on('load', () => {
    beforeMap.addControl(controls);
  });
  afterMap.on('load', () => {
    afterMap.addControl(controls);
  });

  beforeYearSelector.addEventListener('change', async (event) => {
    const year = event.target.value;
    if (year) {
      await updateMapLayerYear(beforeMap, 'vectorSourceBeforeYear', 'vectorLayerBeforeYear', year);
    }
  });

  afterYearSelector.addEventListener('change', async (event) => {
    const year = event.target.value;
    if (year) {
      await updateMapLayerYear(afterMap, 'vectorSourceAfterYear', 'vectorLayerAfterYear', year);
    }
  });

  beforeMonthSelector.addEventListener('change', async (event) => {
    const month = event.target.value;
    if (month) {
      await updateMapLayerMonth(beforeMap, 'vectorSourceBeforeMonth', 'vectorLayerBeforeMonth', month);
    }
  });

  afterMonthSelector.addEventListener('change', async (event) => {
    const month = event.target.value;
    if (month) {
      await updateMapLayerMonth(afterMap, 'vectorSourceAfterMonth', 'vectorLayerAfterMonth', month);
    }
  });

  // Configuración del comparador
  const compare = new maplibregl.Compare(beforeMap, afterMap, '#p13', {
    mousemove: false,
    orientation: 'vertical'
  });

  const slider = compare.slider;
  let isDragging = false;

  const disableTextSelection = () => document.body.classList.add('no-select');
  const enableTextSelection = () => document.body.classList.remove('no-select');

  if (slider) {
    slider.addEventListener('mousedown', () => {
      isDragging = true;
      disableTextSelection();
    });

    window.addEventListener('mouseup', () => {
      if (isDragging) {
        isDragging = false;
        enableTextSelection();
      }
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const rect = slider.parentNode.getBoundingClientRect();
      const offset = (e.clientX - rect.left) / rect.width * 100;
      slider.style.left = `${Math.max(0, Math.min(100, offset))}%`;
      compare.setSlider(offset / 100);
    });
  }
}
