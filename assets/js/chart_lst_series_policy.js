/**
 * Años sin serie LST fiable para visualización (huecos en gráficos).
 * Mantener alineado con ``LST_NULL_SERIES_YEARS`` en ``scripts/gee/products/lst/constants.py``.
 */
export const GENIUS_LST_NULL_SERIES_YEARS = Object.freeze(new Set([2012]));

/** True si el año debe mostrarse como ausencia de dato en series LST (mediana/P25/P75). */
export function geniusLstSeriesYearExcluded(year) {
    const y = Math.round(Number(year));
    return Number.isFinite(y) && GENIUS_LST_NULL_SERIES_YEARS.has(y);
}
