import { createYearSelector, positionYearSelector } from './temp_z_m/utils_z_m_y.js';
import { createMonthSelector, positionMonthSelector } from './temp_z_m/utils_z_m_m.js';
import { LayersControl } from '../control.js';
import { mountLayersControlForExplorer } from '../genius_layers_control_mount.js';
import { updateMapLayerYear, updateMapLayerMonth } from './temp_z_m/layer_z_m.js';
import { createYearLegend, createMonthLegend } from './temp_z_m/legend.js';
import {map_trend, createTrendLegend} from './temp_z_m/trend_m.js';
import { attachMapOpacityPanel } from '../slider_opacity.js';
import { applyOpacityToVectorTrendLayers } from '../maplibre_opacity_util.js';
import { getDefaultYearPair, geniusTitleForProduct, mountGeniusMapTitleElement } from '../map_data_catalog.js';
import { setCompareSingleMapMode } from '../map_compare_mode.js';
import { GENIUS_ZOOM_URBAN, applyGeniusMapLibreInteraction } from '../map_interaction_defaults.js';
import { installLstZonalExplorerHost } from './lst_zonal_explorer.js';

export async function map_t_zonal_m() {
  installLstZonalExplorerHost();
  const [defaultBeforeYear, defaultAfterYear] = getDefaultYearPair('lst');
  const mapTitleText = geniusTitleForProduct(
    'Temperatura por manzana',
    'lst',
  );
  const container = document.getElementById('p16');
  container.innerHTML = `
    <div id="before_m_lst" style="width: 100%; height: 100%;"></div>
    <div id="after_m_lst" style="width: 100%; height: 100%;"></div>
  <div id="title" class="map-title"></div>
  `;
  mountGeniusMapTitleElement(container.querySelector('#title'), mapTitleText, {temporalTitle: true});

  const beforeMap = new maplibregl.Map({
    container: 'before_m_lst', // Contenedor ajustado a 'before_m_lst'
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
    container: 'after_m_lst', // Contenedor ajustado a 'after_m_lst'
    style: {
      version: 8,
      sources: {
        carto: {
          type: 'raster',
          tiles: [
            'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
          ],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
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

  // Zoom +/- (compare sincroniza cámaras): un solo control, esquina superior izquierda del mapa (solo before)
  const beforeNavControl = new maplibregl.NavigationControl({ showCompass: false, showZoom: true });
  beforeMap.addControl(beforeNavControl, 'top-left');

// Agregar controles de escala métrica
  const scaleControlBefore = new maplibregl.ScaleControl({
    maxWidth: 100,
    unit: 'metric'
  });
  beforeMap.addControl(scaleControlBefore, 'bottom-right');

  const scaleControlAfter = new maplibregl.ScaleControl({
    maxWidth: 100,
    unit: 'metric'
  });
  afterMap.addControl(scaleControlAfter, 'bottom-right');

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

   // LEYENDAS
   const yearLegend = createYearLegend();
   const monthLegend = createMonthLegend();
   const trendLegend = createTrendLegend(); // Nueva leyenda de tendencia
   
   yearLegend.style.display = 'none';
   monthLegend.style.display = 'none';
   trendLegend.style.display = 'none';
   
   container.appendChild(yearLegend);
   container.appendChild(monthLegend);
   container.appendChild(trendLegend);

  function createOpacitySlider() {
    attachMapOpacityPanel(container, (opacity) => {
      applyOpacityToVectorTrendLayers(beforeMap, opacity);
      applyOpacityToVectorTrendLayers(afterMap, opacity);
    });
  }
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

  async function setMode(mode) {
    // Remover todas las capas y fuentes del modo anterior
    removeAllLayers(beforeMap);
    removeAllLayers(afterMap);

    // Remover capa de tendencia si existe
    if (beforeMap.getLayer('generic-trend-layer')) {
        beforeMap.removeLayer('generic-trend-layer');
        beforeMap.removeSource('generic-trend');
    }
    if (afterMap.getLayer('generic-trend-layer')) {
        afterMap.removeLayer('generic-trend-layer');
        afterMap.removeSource('generic-trend');
    }

    // Mostrar/ocultar los selectores y leyendas según el modo
      if (mode === 'trend') {
        if (window.compareInstance) {
          window.compareInstance.remove();
          window.compareInstance = null;
        }
        setCompareSingleMapMode({
            container,
            beforeSelector: '#before_m_lst',
            afterSelector: '#after_m_lst',
            beforeMap,
            afterMap,
            enabled: true,
        });
      } else {
        setCompareSingleMapMode({
            container,
            beforeSelector: '#before_m_lst',
            afterSelector: '#after_m_lst',
            beforeMap,
            afterMap,
            enabled: false,
        });
        if (!window.compareInstance) {
          window.compareInstance = new maplibregl.Compare(beforeMap, afterMap, '#p16', {
            mousemove: false,
            orientation: 'vertical'
          });
        }
      }

      if (mode === 'yearly') {
        yearSelectors.style.display = 'block';
        monthSelectors.style.display = 'none';
        yearLegend.style.display = 'block';
        monthLegend.style.display = 'none';
        trendLegend.style.display = 'none';
          const bSel = beforeYearSelector.querySelector('select');
          const aSel = afterYearSelector.querySelector('select');
          if (bSel) bSel.value = defaultBeforeYear;
          if (aSel) aSel.value = defaultAfterYear;
          await updateMapLayerYear(beforeMap, 'vectorSourceBeforeYear', 'vectorLayerBeforeYear', defaultBeforeYear);
          await updateMapLayerYear(afterMap, 'vectorSourceAfterYear', 'vectorLayerAfterYear', defaultAfterYear);
    } else if (mode === 'monthly') {
        yearSelectors.style.display = 'none';
        monthSelectors.style.display = 'block';
        yearLegend.style.display = 'none';
        monthLegend.style.display = 'block';
        trendLegend.style.display = 'none';
          beforeMonthSelector.value = '01';
          afterMonthSelector.value = '12';
          await updateMapLayerMonth(beforeMap, 'vectorSourceBeforeMonth', 'vectorLayerBeforeMonth', '01');
          await updateMapLayerMonth(afterMap, 'vectorSourceAfterMonth', 'vectorLayerAfterMonth', '12');
    } else if (mode === 'trend') {
        // Cargar capa de tendencia en ambos mapas
        await map_trend(beforeMap);
        await map_trend(afterMap);

        // Mostrar solo la leyenda de tendencia y ocultar otros selectores
        yearSelectors.style.display = 'none';
        monthSelectors.style.display = 'none';
        yearLegend.style.display = 'none';
        monthLegend.style.display = 'none';
        trendLegend.style.display = 'block';
    }

}
  const controls = new LayersControl(setMode);
  mountLayersControlForExplorer(controls, container, { zIndex: '10' });

  let mapsLoaded = 0;
  function onMapLoaded() {
    mapsLoaded++;
    if (mapsLoaded === 2) {
      createOpacitySlider();
      setMode('yearly');
    }
  }

  beforeMap.on('load', () => {
    onMapLoaded();
  });

  afterMap.on('load', () => {
    onMapLoaded();
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

  // Reinstancia el comparador
  if (window.compareInstance) {
    window.compareInstance.remove();
  }
  window.compareInstance = new maplibregl.Compare(beforeMap, afterMap, '#p16', {
    mousemove: false,
    orientation: 'vertical'
  });

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
}
