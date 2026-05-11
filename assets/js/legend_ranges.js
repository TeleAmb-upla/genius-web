/**
 * Legend domains from p5–p95 over sampled rasters + zonal GeoJSON.
 * Regenerate: python3 scripts/repo/legends/compute_legend_histogram_ranges.py
 */
export const LEGEND_RANGES = Object.freeze({
    ndvi: Object.freeze({
        raster: Object.freeze({
            yearly: Object.freeze({ min: -0.05, max: 0.65 }),
            monthly: Object.freeze({ min: -0.05, max: 0.7 }),
            trend: Object.freeze({ min: -0.01, max: 0.01 }),
        }),
        zonalBarrio: Object.freeze({
            yearly: Object.freeze({ min: 0.103006, max: 0.27796 }),
            monthly: Object.freeze({ min: 0.107592, max: 0.281105 }),
            trend: Object.freeze({ min: -0.0685043, max: -0.0186583 }),
        }),
        zonalManzana: Object.freeze({
            yearly: Object.freeze({ min: 0.0652984, max: 0.261349 }),
            monthly: Object.freeze({ min: 0.0637111, max: 0.262053 }),
            trend: Object.freeze({ min: -0.0472354, max: -0.0062977 }),
        }),
    }),
    lst: Object.freeze({
        raster: Object.freeze({
            yearly: Object.freeze({ min: 18, max: 38 }),
            monthly: Object.freeze({ min: 1, max: 42 }),
            trend: Object.freeze({ min: -0.22, max: 0.22 }),
        }),
        zonalBarrio: Object.freeze({
            yearly: Object.freeze({ min: 21.8, max: 34.88 }),
            monthly: Object.freeze({ min: 12.99, max: 38.1 }),
            trend: Object.freeze({ min: 0.05915, max: 0.149038 }),
        }),
        zonalManzana: Object.freeze({
            yearly: Object.freeze({ min: 22.06, max: 35.32 }),
            monthly: Object.freeze({ min: 13.05, max: 38.67 }),
            trend: Object.freeze({ min: 0.0578777, max: 0.187464 }),
        }),
    }),
    aod: Object.freeze({
        raster: Object.freeze({
            yearly: Object.freeze({ min: 88, max: 113 }),
            monthly: Object.freeze({ min: 75, max: 13 }),
            trend: Object.freeze({ min: -38, max: 38 }),
        }),
        zonalBarrio: Object.freeze({
            yearly: Object.freeze({ min: 101.4, max: 132.8 }),
            monthly: Object.freeze({ min: 89.15, max: 170.7 }),
            trend: Object.freeze({ min: -0.708336, max: -0.397711 }),
        }),
        zonalManzana: Object.freeze({
            yearly: Object.freeze({ min: 100.5, max: 133.5 }),
            monthly: Object.freeze({ min: 88, max: 170.9 }),
            trend: Object.freeze({ min: -0.717596, max: -0.397711 }),
        }),
    }),
    no2: Object.freeze({
        raster: Object.freeze({
            yearly: Object.freeze({ min: 1, max: 15 }),
            monthly: Object.freeze({ min: 1, max: 27 }),
            trend: Object.freeze({ min: -0.93, max: 0.93 }),
        }),
        zonalBarrio: Object.freeze({
            yearly: Object.freeze({ min: 12.68, max: 14.3 }),
            monthly: Object.freeze({ min: 11.44, max: 23.06 }),
            trend: Object.freeze({ min: -0.93, max: 0.93 }),
        }),
        zonalManzana: Object.freeze({
            yearly: Object.freeze({ min: 12.67, max: 14.38 }),
            monthly: Object.freeze({ min: 11.44, max: 23.2 }),
            trend: Object.freeze({ min: -0.93, max: 0.93 }),
        }),
    }),
    so2: Object.freeze({
        raster: Object.freeze({
            yearly: Object.freeze({ min: 0, max: 5 }),
            monthly: Object.freeze({ min: 0, max: 5 }),
            trend: Object.freeze({ min: -17, max: 17 }),
        }),
        zonalBarrio: Object.freeze({
            yearly: Object.freeze({ min: 69.29, max: 408.4 }),
            monthly: Object.freeze({ min: 74.66, max: 1864.48 }),
            trend: Object.freeze({ min: -35.36, max: -33.97 }),
        }),
        zonalManzana: Object.freeze({
            yearly: Object.freeze({ min: 64.73, max: 416 }),
            monthly: Object.freeze({ min: 71.92, max: 1978.95 }),
            trend: Object.freeze({ min: -35.36, max: -33.97 }),
        }),
    }),
    ndviStdDev: Object.freeze({ min: 0, max: 0.22 }),
});

/**
 * @param {'ndvi'|'lst'|'aod'|'no2'|'so2'} product
 * @param {'raster'|'zonalBarrio'|'zonalManzana'} scope
 * @param {'yearly'|'monthly'|'trend'} mode
 */
export function legendDomain(product, scope, mode) {
    const p = LEGEND_RANGES[product];
    if (!p) return null;
    const s = p[scope];
    if (!s) return null;
    const row = s[mode];
    return row ? [row.min, row.max] : null;
}

export function ndviStdDevLegendDomain() {
    const d = LEGEND_RANGES.ndviStdDev;
    return [d.min, d.max];
}

/** @deprecated Use legendDomain(product, 'raster', mode) */
export function getLegendRange(product, mode) {
    return legendDomain(product, 'raster', mode);
}
