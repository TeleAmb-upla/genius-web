/**
 * Un solo popup MapLibre tipo geo-popup activo en la app (explorador zonal,
 * comparación lado a lado): al abrir uno se cierra cualquier otro en el mismo u otro mapa.
 */

/** @type {unknown[]} */
let activeExclusiveGeoPopups = [];

/**
 * Cierra popups geo previos y registra `popup` antes de `addTo(map)`.
 * @param {import('maplibregl').Popup} popup
 */
export function geniusPrepareExclusiveGeoPopup(popup) {
    const prev = activeExclusiveGeoPopups.slice();
    activeExclusiveGeoPopups = [];
    for (const p of prev) {
        try {
            p.remove();
        } catch (_) {
            /* ignore */
        }
    }
    activeExclusiveGeoPopups.push(popup);
    popup.once("close", () => {
        activeExclusiveGeoPopups = activeExclusiveGeoPopups.filter((x) => x !== popup);
    });
}
