/**
 * index2 (genius-explorer): ancla Anual/Mensual/Tendencia en el panel lateral
 * (#geTemporalLayersMount) si existe; si no, comportamiento legacy sobre el mapa.
 */
export function mountLayersControlForExplorer (controls, fallbackParent, opts = {}) {
    const el = controls._container;
    const z = opts.zIndex ?? '10';
    const mount = document.getElementById('geTemporalLayersMount');
    el.style.position = '';
    el.style.top = '';
    el.style.right = '';
    el.style.zIndex = '';
    if (mount) {
        mount.replaceChildren(el);
        return;
    }
    el.style.position = 'absolute';
    el.style.top = '10px';
    el.style.right = '10px';
    el.style.zIndex = z;
    fallbackParent.appendChild(el);
}
