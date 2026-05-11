/**
 * Panel de opacidad centrado abajo (estilos en main.css: .map-ui-opacity-panel).
 */

/**
 * @param {HTMLElement} hostElement
 * @param {(opacity: number) => void} onOpacity - opacidad en [0, 1]
 * @param {{ leafletMap?: object }} [options] - Si existe, usa L.DomEvent para no interferir con el mapa.
 */
export function attachMapOpacityPanel(hostElement, onOpacity, options = {}) {
    const wrapper = document.createElement('div');
    wrapper.className = 'map-ui-opacity-panel';
    if (!document.getElementById('geTourMapOpacityPanel')) {
        wrapper.id = 'geTourMapOpacityPanel';
    }
    const label = document.createElement('span');
    label.className = 'map-ui-opacity-panel__label';
    label.textContent = 'Opacidad capa';

    const row = document.createElement('div');
    row.className = 'map-ui-opacity-panel__row';
    const input = document.createElement('input');
    input.className = 'map-ui-opacity-panel__range';
    input.type = 'range';
    input.min = '0';
    input.max = '100';
    input.value = '100';
    input.setAttribute('aria-label', 'Opacidad de la capa');

    const valueEl = document.createElement('span');
    valueEl.className = 'map-ui-opacity-panel__value';
    valueEl.textContent = '100%';

    row.appendChild(input);
    row.appendChild(valueEl);
    wrapper.appendChild(label);
    wrapper.appendChild(row);
    hostElement.appendChild(wrapper);

    const leafletMap = options.leafletMap;
    if (leafletMap && typeof L !== 'undefined') {
        L.DomEvent.disableClickPropagation(wrapper);
        L.DomEvent.disableScrollPropagation(wrapper);
    } else {
        ['mousedown', 'dblclick', 'click', 'wheel'].forEach((ev) => {
            wrapper.addEventListener(ev, (e) => e.stopPropagation());
        });
    }

    function applyOpacity() {
        const opacity = Math.max(0, Math.min(1, parseInt(input.value, 10) / 100));
        valueEl.textContent = `${Math.round(opacity * 100)}%`;
        onOpacity(opacity);
    }

    input.addEventListener('input', applyOpacity);
    applyOpacity();
}

export async function createOpacitySlider(map, layers, currentLayerTypeRef) {
    attachMapOpacityPanel(
        map.getContainer(),
        (opacity) => {
            const mode = currentLayerTypeRef.value;
            if (mode === 'Anual' || mode === 'Mensual') {
                if (layers.leftLayer) layers.leftLayer.setOpacity(opacity);
                if (layers.rightLayer) layers.rightLayer.setOpacity(opacity);
            } else if (mode === 'Tendencia') {
                if (layers.trendLayer) layers.trendLayer.setOpacity(opacity);
            }
        },
        { leafletMap: map },
    );
}
