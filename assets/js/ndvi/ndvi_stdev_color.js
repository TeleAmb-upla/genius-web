import { ndviStdDevLegendDomain } from "../legend_ranges.js";
import { physicalNdviStdDev } from "../raster_quantized_decode.js";

/** Paleta compartida: raster píxel y polígonos zonal (misma escala DE). */
export const NDVI_STDEV_COLOR_RANGE = Object.freeze([
    "#B9B0B9",
    "#C7979E",
    "#D57E83",
    "#E36468",
    "#F14B4D",
    "#FF3232",
]);

/**
 * Color de relleno para un valor crudo de DE (GeoTIFF o propiedad zonal).
 * Misma lógica que el mapa raster.
 */
export function ndviStdDevRawToColor(rawValue) {
    const v = physicalNdviStdDev(
        rawValue == null || rawValue === "" ? NaN : Number(rawValue),
    );
    if (Number.isNaN(v)) return null;
    const domain = ndviStdDevLegendDomain();
    const range = NDVI_STDEV_COLOR_RANGE;
    const n = range.length;
    const w = (domain[1] - domain[0]) / n;
    if (v < domain[0]) return range[0];
    if (v > domain[1]) return range[n - 1];
    const idx = Math.min(n - 1, Math.floor((v - domain[0]) / w));
    return range[idx];
}
