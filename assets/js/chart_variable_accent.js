/**
 * Color de acento por variable (alineado a iconos Genius / paleta del sitio).
 * Usado para la serie «año actual» en gráficos mensuales.
 */
export const GENIUS_MONTHLY_ANIO_COLOR = {
    /** Vegetación — verde bosque */
    ndvi: "#228B22",
    /** Temperatura — naranja térmico */
    lst: "#e6550d",
    /** AOD — turquesa del icono (gradiente #5ec9d4 / #2cb8c7) */
    aod: "#2cb8c7",
    /** NO₂ — terracota del núcleo del icono */
    no2: "#cf653d",
    /** SO₂ — amarillo–verde del relleno del icono */
    so2: "#c9c448",
};

/**
 * @param {keyof typeof GENIUS_MONTHLY_ANIO_COLOR | string} key
 */
export function geniusMonthlyAnioColor(key) {
    return GENIUS_MONTHLY_ANIO_COLOR[key] || "#d95f02";
}
