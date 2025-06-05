import { createYearSelector, positionYearSelector } from './ndvi_z_b/utils_z_b_y.js';
import { createMonthSelector, positionMonthSelector } from './ndvi_z_b/utils_z_b_m.js';
import { LayersControl } from '../control.js';
import { updateMapLayerYear, updateMapLayerMonth } from './ndvi_z_b/layer_z_b.js';
import { createYearLegend, createMonthLegend } from './ndvi_z_b/legend.js';
import {map_trend, createTrendLegend} from './ndvi_z_b/trend_b.js';
import{ loadInfCriticaMapLibre } from '../inf_critica_map_libre.js';

let trendAdditionalTextDiv = null; // Variable global para el cuadro de texto adicional

export async function map_ndvi_zonal_b() {

  function createTrendAdditionalText(content) {
    const textDiv = document.createElement('div');
    textDiv.id = 'trend-additional-text';
    
    // Estilos para el cuadro de texto
    textDiv.style.position = 'absolute';
    textDiv.style.top = 'calc(50% + 100px)'; // Ajusta este valor según la posición de la leyenda
    textDiv.style.left = '10px'; // Alineado con la leyenda
    textDiv.style.backgroundColor = 'white';
    textDiv.style.padding = '10px';
    textDiv.style.borderRadius = '8px';
    textDiv.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
    textDiv.style.zIndex = '1000';
    textDiv.style.width = '200px'; // Ajusta el ancho según necesidad
    textDiv.innerHTML = content;
    
    return textDiv;
  }
  

  const container = document.getElementById('p04');
  container.innerHTML = `
    <div id="before" style="width: 100%; height: 100%;"></div>
    <div id="after" style="width: 100%; height: 100%;"></div>
<div id="title" class="map-title">
    NDVI Estadística Zonal (Barrio)
    </div>
  `;

  const beforeMap = new maplibregl.Map({
    container: 'before',
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
    container: 'after',
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
 
   // Reemplaza la función createOpacitySlider por una versión basada en slider_opacity.js
  function createOpacitySlider() {
    // Crear el contenedor principal del slider y agregarlo al contenedor del mapa
    const wrapper = document.createElement('div');
    wrapper.className = 'wrapper';
    container.appendChild(wrapper);

    // Crear el contenedor del slider
    const mapSlider = document.createElement('div');
    mapSlider.className = 'map-slider';
    wrapper.appendChild(mapSlider);

    // Crear el contenedor de los botones
    const buttons = document.createElement('div');
    buttons.className = 'buttons';
    mapSlider.appendChild(buttons);

    // Botón de más
    const plusButton = document.createElement('span');
    plusButton.textContent = '+';
    buttons.appendChild(plusButton);

    // Contenedor de la línea y el botón draggable
    const dragLine = document.createElement('div');
    dragLine.className = 'drag-line';
    buttons.appendChild(dragLine);

    const line = document.createElement('div');
    line.className = 'line';
    dragLine.appendChild(line);

    const draggableButton = document.createElement('div');
    draggableButton.className = 'draggable-button';
    dragLine.appendChild(draggableButton);

    // Crear el indicador de porcentaje
    const percentageDisplay = document.createElement('div');
    percentageDisplay.className = 'percentage-display';
    dragLine.appendChild(percentageDisplay);

    // Botón de menos
    const minusButton = document.createElement('span');
    minusButton.textContent = '-';
    buttons.appendChild(minusButton);

    // Evitar propagación de eventos al mapa
    wrapper.addEventListener('mousedown', (e) => e.stopPropagation());
    wrapper.addEventListener('mousemove', (e) => e.stopPropagation());
    wrapper.addEventListener('mouseup', (e) => e.stopPropagation());

    // Agregar los estilos CSS al documento desde JavaScript (idénticos a slider_opacity.js)
    const style = document.createElement('style');
    style.type = 'text/css';
    const css = `
      .wrapper {
        width: 52px;
        position: absolute;
        top: 50%;
        right: 20px;
        transform: translateY(-50%);
        z-index: 1000;
        user-select: none;
      }
      .map-slider {
        width: 52px;
        height: 330px;
        background: #f7f7f7;
        border-radius: 3px;
        text-align: center;
        box-shadow: 0 0 3px 1px rgba(0,0,0,0.2);
        position: relative;
        color: #866a62;
      }
      .map-slider::before {
        content: "";
        width: 100%;
        height: 1px;
        background: #dedede;
        position: absolute;
        left: 0;
        margin-top: 50px;
        box-shadow:
          0 1px 0 0 white,
          0 230px 0 0 #dedede,
          0 229px 0 0 white;
      }
      .buttons span {
        display: block;
        height: 50px;
        cursor: pointer;
        padding-top: 16px;
        font-size: 24px;
        line-height: 18px;
      }
      .drag-line {
        width: 8px;
        height: 182px;
        background: #ff9770;
        border-radius: 8px;
        margin: 25px auto;
        position: relative;
      }
      .line {
        width: 8px;
        height: 182px;
        background: #adccce;
        border-radius: 8px;
        position: absolute;
        top: 0;
      }
      .draggable-button {
        width: 29px;
        height: 29px;
        background: #f7f7f7;
        border-radius: 50%;
        position: absolute;
        box-shadow: 0px 4px 10px 1px rgba(0,0,0,0.2);
        margin-left: -9px;
        cursor: pointer;
        top: 0;
      }
      .percentage-display {
        position: absolute;
        width: 100%;
        text-align: center;
        top: calc(100% + 10px);
        font-size: 14px;
        color: #333;
      }
      /* --- Adaptabilidad para móvil --- */
      /* --- MOBILE VERSION --- */
      @media (max-width: 600px) {
        .wrapper {
          width: 38px;
          right: 10px;
          left: auto;
          top: 50%;
          bottom: auto;
          transform: translateY(-50%);
          position: absolute;
        }
        .map-slider {
          width: 38px;
          height: 180px;
          font-size: 12px;
        }
        .buttons span {
          height: 32px;
          padding-top: 7px;
          font-size: 18px;
        }
        .drag-line {
          width: 6px;
          height: 90px;
          margin: 10px auto;
        }
        .line {
          width: 6px;
          height: 90px;
        }
        .draggable-button {
          width: 18px;
          height: 18px;
          margin-left: -6px;
        }
        .percentage-display {
          font-size: 11px;
          top: calc(100% + 4px);
        }
      }
    `;
    if (style.styleSheet) {
      style.styleSheet.cssText = css;
    } else {
      style.appendChild(document.createTextNode(css));
    }
    document.head.appendChild(style);

    // Variables para el arrastre
    let isDragging = false;
    let startY;
    let startTop;
    const dragMax = 182 - 29; // Altura de la línea menos la altura del botón

    // Funciones para manejar el arrastre
    draggableButton.addEventListener('mousedown', function(e) {
      isDragging = true;
      startY = e.clientY;
      startTop = parseInt(draggableButton.style.top || '0', 10);
      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
      if (!isDragging) return;
      let deltaY = e.clientY - startY;
      let newTop = startTop + deltaY;
      newTop = Math.max(0, Math.min(newTop, dragMax));
      draggableButton.style.top = newTop + 'px';
      updateLine(newTop);
      updateOpacity(newTop);
    }

    function onMouseUp() {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    }

    // Función para actualizar la línea
    function updateLine(position) {
      let clipValue = position + 'px, 8px, 183px, 0px';
      line.style.clip = 'rect(' + clipValue + ')';
    }

    // Función para actualizar la opacidad y el indicador de porcentaje
    function updateOpacity(position) {
      let opacity = 1 - (position / dragMax);
      opacity = Math.max(0, Math.min(opacity, 1));
      setMapLayersOpacity(beforeMap, opacity);
      setMapLayersOpacity(afterMap, opacity);
      const percentageValue = Math.round(opacity * 100);
      percentageDisplay.textContent = `${percentageValue}%`;
    }

    function setMapLayersOpacity(map, opacity) {
      if (!map.getStyle() || !map.getStyle().layers) return;
      const layers = map.getStyle().layers;
      layers.forEach((layer) => {
        if (layer.id.startsWith('vectorLayer') || layer.id === 'generic-trend-layer') {
          const layerType = map.getLayer(layer.id).type;
          if (layerType === 'fill') {
            map.setPaintProperty(layer.id, 'fill-opacity', opacity);
          } else if (layerType === 'line') {
            map.setPaintProperty(layer.id, 'line-opacity', opacity);
          } else if (layerType === 'symbol') {
            map.setPaintProperty(layer.id, 'icon-opacity', opacity);
            map.setPaintProperty(layer.id, 'text-opacity', opacity);
          } else if (layerType === 'raster') {
            map.setPaintProperty(layer.id, 'raster-opacity', opacity);
          }
        }
      });
    }

    // Eventos para los botones de más y menos
    plusButton.addEventListener('click', function() {
      let currentTop = parseInt(draggableButton.style.top || '0', 10);
      let newTop = currentTop - 14;
      newTop = Math.max(0, newTop);
      draggableButton.style.top = newTop + 'px';
      updateLine(newTop);
      updateOpacity(newTop);
    });

    minusButton.addEventListener('click', function() {
      let currentTop = parseInt(draggableButton.style.top || '0', 10);
      let newTop = currentTop + 14;
      newTop = Math.min(newTop, dragMax);
      draggableButton.style.top = newTop + 'px';
      updateLine(newTop);
      updateOpacity(newTop);
    });

    // Inicializar la línea y opacidad
    updateLine(0);
    updateOpacity(0);
  }
 
  // Definir la función para crear el cuadro de texto adicional
  function createTrendAdditionalText(content) {
    const textDiv = document.createElement('div');
    textDiv.id = 'trend-additional-text';
    
    // Estilos para el cuadro de texto
    textDiv.style.position = 'absolute';
    textDiv.style.top = 'calc(50% + 100px)'; // Ajusta este valor según la posición de la leyenda
    textDiv.style.left = '10px'; // Alineado con la leyenda
    textDiv.style.backgroundColor = 'white';
    textDiv.style.padding = '10px';
    textDiv.style.borderRadius = '8px';
    textDiv.style.boxShadow = '0 0 5px rgba(0,0,0,0.3)';
    textDiv.style.zIndex = '1000';
    textDiv.style.width = '200px'; // Ajusta el ancho según necesidad
    textDiv.innerHTML = content;
    
    return textDiv;
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
    if (mode === 'yearly') {
        yearSelectors.style.display = 'block';
        monthSelectors.style.display = 'none';
        yearLegend.style.display = 'block';
        monthLegend.style.display = 'none';
        trendLegend.style.display = 'none';
    } else if (mode === 'monthly') {
        yearSelectors.style.display = 'none';
        monthSelectors.style.display = 'block';
        yearLegend.style.display = 'none';
        monthLegend.style.display = 'block';
        trendLegend.style.display = 'none';
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
      /*  
      // Crear y agregar el nuevo cuadro de texto adicional
      const additionalContent = `
        <p>Este análisis muestra la tendencia del NDVI en los últimos años, indicando áreas de crecimiento o declive en la vegetación urbana.</p>
      `;
      */
      trendAdditionalTextDiv = createTrendAdditionalText(additionalContent);
      container.appendChild(trendAdditionalTextDiv);
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

    // Reiniciar los selectores para evitar selecciones inconsistentes
    beforeYearSelector.value = '';
    afterYearSelector.value = '';
    beforeMonthSelector.value = '';
    afterMonthSelector.value = '';
}



 
   const controls = new LayersControl(setMode);
 
   // Esperar a que ambos mapas carguen completamente
   let mapsLoaded = 0;
   function onMapLoaded() {
     mapsLoaded++;
     if (mapsLoaded === 2) {
       // Ambos mapas han cargado, podemos inicializar el slider de opacidad
       createOpacitySlider();
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
   window.compareInstance = new maplibregl.Compare(beforeMap, afterMap, '#p04', {
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
