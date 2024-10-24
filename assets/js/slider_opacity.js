export async function createOpacitySlider(map, layers, currentLayerTypeRef) {
    const { leftLayer, rightLayer} = layers;
    let currentLayerType = currentLayerTypeRef.value;

    // Crear el contenedor principal del slider y agregarlo al mapa
    const wrapper = L.DomUtil.create('div', 'wrapper');
    map.getContainer().appendChild(wrapper);

    // Crear el contenedor del slider
    const mapSlider = L.DomUtil.create('div', 'map-slider', wrapper);

    // Crear el contenedor de los botones
    const buttons = L.DomUtil.create('div', 'buttons', mapSlider);

    // Botón de más
    const plusButton = L.DomUtil.create('span', '', buttons);
    plusButton.textContent = '+';

    // Contenedor de la línea y el botón draggable
    const dragLine = L.DomUtil.create('div', 'drag-line', buttons);
    const line = L.DomUtil.create('div', 'line', dragLine);
    const draggableButton = L.DomUtil.create('div', 'draggable-button', dragLine);

    // Crear el indicador de porcentaje
    const percentageDisplay = L.DomUtil.create('div', 'percentage-display', dragLine);

    // Botón de menos
    const minusButton = L.DomUtil.create('span', '', buttons);
    minusButton.textContent = '-';

    // Evitar que los eventos del slider se propaguen al mapa
    L.DomEvent.disableClickPropagation(wrapper);

    // Agregar los estilos CSS al documento desde JavaScript
    const style = document.createElement('style');
    style.type = 'text/css';
    const css = `
      /* Estilos generales */
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

      // Actualizar la opacidad de las capas
      if (layers.leftLayer) {
        layers.leftLayer.setOpacity(opacity);
      }
      if (layers.rightLayer) {
        layers.rightLayer.setOpacity(opacity);
      }
      // Actualizar el indicador de porcentaje
      const percentageValue = Math.round(opacity * 100);
      percentageDisplay.textContent = `${percentageValue}%`;
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
