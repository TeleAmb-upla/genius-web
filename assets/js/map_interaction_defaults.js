/**
 * Zoom y rueda compartidos en mapas GENIUS (Leaflet + MapLibre).
 */

export const GENIUS_LAT = -33.04752000;
export const GENIUS_LNG = -71.44249000;

/** Vista urbana habitual (antes ~12.6): un poco más alejada */
export const GENIUS_ZOOM_URBAN = 11.75;

/** Vistas regionales / píxel (antes ~10.9) */
export const GENIUS_ZOOM_REGIONAL = 10.15;

/** Leaflet: pasos más finos (zoomSnap / zoomDelta) y rueda menos brusca */
export const GENIUS_LEAFLET_MAP_OPTIONS = Object.freeze({
  zoomSnap: 0.25,
  zoomDelta: 0.5,
  wheelPxPerZoomLevel: 96,
  /* Un solo control +/-: addGeniusLeafletZoomControl (el default de Leaflet duplicaba botones) */
  zoomControl: false,
});

/**
 * MapLibre: rueda con incrementos más pequeños entre niveles.
 * Llamar justo después de `new maplibregl.Map(...)`.
 */
export function applyGeniusMapLibreInteraction(map) {
  if (!map) return;
  const tune = () => {
    try {
      if (map.scrollZoom && typeof map.scrollZoom.setWheelZoomRate === 'function') {
        map.scrollZoom.setWheelZoomRate(1 / 240);
      }
    } catch (_e) {
      /* ignore */
    }
  };
  map.once('load', tune);
}

/**
 * Botones +/- en mapas Leaflet (acceso sin rueda del ratón).
 * Leaflet debe estar cargado globalmente como `L`.
 */
export function addGeniusLeafletZoomControl(map, position = 'topleft') {
  if (!map || typeof L === 'undefined' || !L.control || typeof L.control.zoom !== 'function') {
    return;
  }
  L.control.zoom({
    position,
    zoomInTitle: 'Acercar',
    zoomOutTitle: 'Alejar',
  }).addTo(map);
}
