/**
 * Precomputed legend ranges (5th / 95th percentile) for all variables.
 * Trend ranges are symmetric around 0.
 * Update these values when new data arrives by running the histogram analysis.
 */
export const LEGEND_RANGES = {
    ndvi: {
        yearly:  { min: -0.05, max: 0.65 },
        monthly: { min: -0.05, max: 0.70 },
        trend:   { min: -0.01, max: 0.01 },
    },
    lst: {
        yearly:  { min: 18, max: 38 },
        monthly: { min: 10, max: 42 },
        trend:   { min: -0.22, max: 0.22 },
    },
    aod: {
        yearly:  { min: 88, max: 113 },
        monthly: { min: 75, max: 130 },
        trend:   { min: -38, max: 38 },
    },
    no2: {
        yearly:  { min: 10, max: 15 },
        monthly: { min: 10, max: 27 },
        trend:   { min: -0.93, max: 0.93 },
    },
    so2: {
        yearly:  { min: 0, max: 500 },
        monthly: { min: 0, max: 500 },
        trend:   { min: -170, max: 170 },
    },
};

export function getLegendRange(product, mode) {
    const p = LEGEND_RANGES[product];
    if (!p) return null;
    return p[mode] || null;
}
