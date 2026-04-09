import { createYearSelector, positionYearSelector } from './aod_z_b/utils_z_b_y.js'; 
import { createMonthSelector, positionMonthSelector } from './aod_z_b/utils_z_b_m.js';
import { LayersControl } from '../control.js';
import { updateMapLayerYear, updateMapLayerMonth } from './aod_z_b/layer_z_b.js';
import { createYearLegend, createMonthLegend } from './aod_z_b/legend.js';
import {map_trend, createTrendLegend} from './aod_z_b/trend_b.js';
import{ loadInfCriticaMapLibre } from '../inf_critica_map_libre.js';
import { attachMapOpacityPanel } from '../../slider_opacity.js';
import { applyOpacityToVectorTrendLayers } from '../../maplibre_opacity_util.js';
import { getDefaultYearPair } from '../../map_data_catalog.js';
import { setCompareSingleMapMode } from '../../map_compare_mode.js';

export async function map_aod_b() {
  const [defaultBeforeYear, defaultAfterYear] = getDefaultYearPair('aod');
  
  const container = document.getElementById('p22');
  container.innerHTML = `
    <div id="before_b_aod" style="width: 100%; height: 100%;"></div>
    <div id="after_b_aod" style="width: 100%; height: 100%;"></div>
<div id="title" class="map-title">
    AOD Estadística Zonal (Barrio)
    </div>
  `;

  const beforeMap = new maplibregl.Map({
    container: 'before_b_aod', // Contenedor ajustado a 'before_b_aod'
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
    container: 'after_b_aod', // Contenedor ajustado a 'after_b_aod'
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
   
     // Agregar controles de escala métrica
     const scaleControlBefore = new maplibregl.ScaleControl({
       maxWidth: 100,
       unit: 'metric'
     });
     beforeMap.addControl(scaleControlBefore, 'top-right');
   
     const scaleControlAfter = new maplibregl.ScaleControl({
       maxWidth: 100,
       unit: 'metric'
     });
     afterMap.addControl(scaleControlAfter, 'top-right');
   
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
      setCompareSingleMapMode({
          container,
          beforeSelector: '#before_b_aod',
          afterSelector: '#after_b_aod',
          beforeMap,
          afterMap,
          enabled: mode === 'trend',
      });

      if (window.compareInstance && window.compareInstance.slider) {
          window.compareInstance.slider.style.display = mode === 'trend' ? 'none' : 'block';
      }

      if (mode === 'yearly') {
          yearSelectors.style.display = 'block';
          monthSelectors.style.display = 'none';
          yearLegend.style.display = 'block';
          monthLegend.style.display = 'none';
          trendLegend.style.display = 'none';
          beforeYearSelector.value = defaultBeforeYear;
          afterYearSelector.value = defaultAfterYear;
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
  
          // Ocultar el slider para dar la ilusión de un solo mapa
          if (window.compareInstance && window.compareInstance.slider) {
              window.compareInstance.slider.style.display = 'none';
          }
      } else if (mode === 'infraestructura') {
          // Cargar la capa de infraestructura crítica en ambos mapas
          try {
              const infraLayerBefore = await loadInfCriticaMapLibre(beforeMap);
              const infraLayerAfter = await loadInfCriticaMapLibre(afterMap);
  
              if (infraLayerBefore && infraLayerAfter) {
              }
  
              // Mostrar/ocultar leyendas y selectores si es necesario
              yearSelectors.style.display = 'none';
              monthSelectors.style.display = 'none';
              yearLegend.style.display = 'none';
              monthLegend.style.display = 'none';
              trendLegend.style.display = 'none';
          } catch (error) {
              console.error('Error al cargar la capa de infraestructura crítica:', error);
          }
      }
  
  }
   
     const controls = new LayersControl(setMode);
   
     // Esperar a que ambos mapas carguen completamente
     let mapsLoaded = 0;
     function onMapLoaded() {
       mapsLoaded++;
       if (mapsLoaded === 2) {
         // Ambos mapas han cargado, podemos inicializar el slider de opacidad
         createOpacitySlider();
        const yearlyRadio = controls._container.querySelector('input[type="radio"]');
        if (yearlyRadio) yearlyRadio.checked = true;
        setMode('yearly');
       }
     }
   
     beforeMap.on('load', () => {
       beforeMap.addControl(controls);
       onMapLoaded();
     });
   
     afterMap.on('load', () => {
       afterMap.addControl(controls);
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
     window.compareInstance = new maplibregl.Compare(beforeMap, afterMap, '#p22', {
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
   