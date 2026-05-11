/**
 * Textos / descargas: carga aparte para no bloquear el registro de mapas.
 */
(async function loadExplorerText() {
  try {
    const {
      text_ndvi,
      text_lst,
      text_aod,
      text_no2,
      text_so2,
      text_lum,
      text_hu,
      text_isla,
    } = await import('./text.js');

    window.text_ndvi = text_ndvi;
    window.text_lst = text_lst;
    window.text_aod = text_aod;
    window.text_no2 = text_no2;
    window.text_so2 = text_so2;
    window.text_lum = text_lum;
    window.text_hu = text_hu;
    window.text_isla = text_isla;
    window.dispatchEvent(new Event('genius-explorer-text-ready'));
  } catch (e) {
    console.error('[GENIUS] index2-explorer-text failed:', e);
  }
})();
