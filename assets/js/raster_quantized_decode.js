/**
 * GeoTIFF de mapas píxel: soporte para valores float (legacy) y enteros
 * cuantizados (menor tamaño / carga más rápida). Escalas en
 * `scripts/repo/rasters/quantize_rasters_web.py` y exportaciones GEE.
 */
export const INT16_NODATA = -32768;

function nodataNaN(s) {
    if (s === INT16_NODATA || s === null || s === undefined) return NaN;
    if (typeof s === "number" && Number.isNaN(s)) return NaN;
    return s;
}

/** NDVI físico ≈ -1…1: float se deja; enteros ×1e4. */
export function physicalNdvi(s) {
    const v = nodataNaN(s);
    if (Number.isNaN(v)) return NaN;
    if (Math.abs(v) > 1.2) return v / 10000;
    return v;
}

/** Tendencia NDVI (pendiente pequeña). */
export function physicalNdviTrend(s) {
    const v = nodataNaN(s);
    if (Number.isNaN(v)) return NaN;
    if (Math.abs(v) > 0.2) return v / 100000;
    return v;
}

/** Desviación estándar NDVI. */
export function physicalNdviStdDev(s) {
    const v = nodataNaN(s);
    if (Number.isNaN(v)) return NaN;
    if (v > 0.5) return v / 100000;
    return v;
}

/** LST °C. */
export function physicalLst(s) {
    const v = nodataNaN(s);
    if (Number.isNaN(v)) return NaN;
    if (Math.abs(v) > 150) return v / 100;
    return v;
}

/** Tendencia LST (pendiente anual en unidades del raster). */
export function physicalLstTrend(s) {
    const v = nodataNaN(s);
    if (Number.isNaN(v)) return NaN;
    if (Math.abs(v) > 2) return v / 10000;
    return v;
}

/** AOD (dominio raster en leyenda). */
export function physicalAod(s) {
    const v = nodataNaN(s);
    if (Number.isNaN(v)) return NaN;
    if (Math.abs(v) > 250) return v / 100;
    return v;
}

/** Tendencia AOD. */
export function physicalAodTrend(s) {
    const v = nodataNaN(s);
    if (Number.isNaN(v)) return NaN;
    if (Math.abs(v) > 80) return v / 10000;
    return v;
}

/** NO2 (regresión / leyenda raster). */
export function physicalNo2(s) {
    const v = nodataNaN(s);
    if (Number.isNaN(v)) return NaN;
    if (Math.abs(v) > 80) return v / 1000;
    return v;
}

export function physicalNo2Trend(s) {
    const v = nodataNaN(s);
    if (Number.isNaN(v)) return NaN;
    if (Math.abs(v) > 3) return v / 10000;
    return v;
}

/** SO2: mismas unidades en float o entero redondeado (Int16). */
export function physicalSo2(s) {
    return nodataNaN(s);
}
