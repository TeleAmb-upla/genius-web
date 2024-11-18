import { createYearSelector, positionYearSelector } from './isla_de_calor/ultis_isla_y.js';
import { LayersControl } from './isla_de_calor/control_isla.js';
import { updateMapLayerYear_isla } from './isla_de_calor/layer_isla.js';
import { legend_isla} from './isla_de_calor/legend_isla.js';

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

    // Función para crear el slider de opacidad y su funcionalidad
    function createOpacitySlider() {
        // Crear el contenedor del slider de opacidad
        const opacitySliderContainer = document.createElement('div');
        opacitySliderContainer.id = 'opacity-slider-container';
        container.appendChild(opacitySliderContainer);

        // Agregar estilos CSS para el slider
        const style = document.createElement('style');
        style.type = 'text/css';
        style.innerHTML = `
            #opacity-slider-container {
                width: 52px;
                position: absolute;
                top: 50%;
                right: 20px;
                transform: translateY(-50%);
                z-index: 1000;
                user-select: none;
            }

            .opacity-slider {
                width: 52px;
                height: 330px;
                background: #f7f7f7;
                border-radius: 3px;
                text-align: center;
                box-shadow: 0 0 3px 1px rgba(0,0,0,0.2);
                position: relative;
                color: #866a62;
            }

            .opacity-slider::before {
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
                top: 0; /* Inicialmente en la parte superior */
            }

            /* Estilos para el indicador de porcentaje */
            .percentage-display {
                position: absolute;
                width: 100%;
                text-align: center;
                top: calc(100% + 10px); /* Ubicarlo justo debajo del dragLine */
                font-size: 14px;
                color: #333;
            }
        `;
        document.head.appendChild(style);

        // Crear el slider y sus componentes
        const opacitySlider = document.createElement('div');
        opacitySlider.className = 'opacity-slider';
        opacitySliderContainer.appendChild(opacitySlider);

        // Crear el contenedor de los botones
        const buttons = document.createElement('div');
        buttons.className = 'buttons';
        opacitySlider.appendChild(buttons);

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

        // Evitar la propagación de eventos
        opacitySliderContainer.addEventListener('mousedown', (e) => {
            e.stopPropagation();
        });
        opacitySliderContainer.addEventListener('mousemove', (e) => {
            e.stopPropagation();
        });
        opacitySliderContainer.addEventListener('mouseup', (e) => {
            e.stopPropagation();
        });

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
            // La línea debe recortarse desde la posición del botón hacia abajo
            let clipValue = position + 'px, 8px, 183px, 0px';
            line.style.clip = 'rect(' + clipValue + ')';
        }

        // Función para actualizar la opacidad y el indicador de porcentaje
        function updateOpacity(position) {
            // Calcular la opacidad basada en la posición del botón
            let opacity = 1 - (position / dragMax);
            // Asegurarse de que la opacidad esté entre 0 y 1
            opacity = Math.max(0, Math.min(opacity, 1));

            // Actualizar la opacidad de las capas en ambos mapas
            setMapLayersOpacity(beforeMap, opacity);
            setMapLayersOpacity(afterMap, opacity);

            // Actualizar el indicador de porcentaje
            const percentageValue = Math.round(opacity * 100);
            percentageDisplay.textContent = `${percentageValue}%`;
        }

        // Función para establecer la opacidad de las capas del mapa
        function setMapLayersOpacity(map, opacity) {
            // Verificar si el estilo del mapa está cargado
            if (!map.getStyle() || !map.getStyle().version) return;

            const layers = map.getStyle().layers;

            layers.forEach((layer) => {
                // Ajustar la opacidad para capas relevantes
                if (layer.id.startsWith('vectorLayer') || layer.id === 'generic-trend-layer') {
                    const layerType = map.getLayer(layer.id).type;

                    // Ajustar opacidad según el tipo de capa
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
                    // Agrega otros tipos de capas si es necesario
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

    // Llamar a la función para crear el slider de opacidad después de que ambos mapas se hayan cargado
    createOpacitySlider();
        // Llamar a la función para crear la leyenda
        legend_isla();

}
