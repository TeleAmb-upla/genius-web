/**
 * Color común para tendencia zonal (misma escala que raster de tendencia por producto).
 */
import { trendColorFromValue, trendSpecFromDomain } from "../trend_scale.js";

/**
 * @param {number} value slope_median
 * @param {[number, number]} domain [min, max] desde legendDomain (se normaliza en 0 si aplica)
 * @param {'ndvi'|'lst'|'aod'|'no2'|'so2'} product
 */
export function zonalTrendSlopeToColor(value, domain, product) {
    const spec = trendSpecFromDomain(domain, product);
    if (!spec) return "#ffffff";
    const c = trendColorFromValue(value, spec);
    return c == null ? "rgba(0,0,0,0)" : c;
}

/**
 * @param {number} value slope_median
 * @param {[number, number]} domain
 */
export function zonalNdviTrendSlopeToColor(value, domain) {
    return zonalTrendSlopeToColor(value, domain, "ndvi");
}
