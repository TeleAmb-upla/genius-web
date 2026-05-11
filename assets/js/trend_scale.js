/**
 * Escala común para tendencias: dominio centrado en 0 cuando hay valores negativos y
 * positivos; rampa unilateral con tonos claros cerca de 0 e intenso en el extremo.
 *
 * Convención de color:
 * - NDVI: tendencia negativa → rojo, positiva → azul.
 * - LST, AOD, NO₂, SO₂: tendencia negativa → azul, positiva → rojo.
 */
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { legendDomain } from "./legend_ranges.js";

/** NDVI divergente: rojo (negativo) → blanco (0) → azul (positivo). */
const STOPS_DIVERGING_NDVI = [
    "#ff0000",
    "#ff3d66",
    "#ff75ad",
    "#ffffff",
    "#75aaff",
    "#4d66ff",
    "#0313ff",
];

/** ATM divergente: azul (negativo) → blanco (0) → rojo (positivo). */
const STOPS_DIVERGING_ATM = [
    "#0313ff",
    "#4d66ff",
    "#75aaff",
    "#ffffff",
    "#ff75ad",
    "#ff3d66",
    "#ff0000",
];

/** Azul claro (cerca de 0) → azul intenso (lejos). */
const STOPS_BLUE_LIGHT_TO_DARK = [
    "#eef5ff",
    "#b3d4ff",
    "#75aaff",
    "#4d66ff",
    "#1a3dcc",
    "#0313ff",
];

/** Rojo intenso (más negativo / lejos de 0 en rama negativa) → rojo muy claro (cerca de 0). */
const STOPS_RED_DARK_TO_LIGHT = [
    "#ff0000",
    "#ff3d66",
    "#ff75ad",
    "#ffc9dc",
    "#fff5f7",
];

/** Rosa casi blanco (cerca de 0 en rama positiva ATM / NDVI neg con misma lógica) → rojo intenso. */
const STOPS_RED_LIGHT_TO_DARK = [
    "#fff5f7",
    "#ffc9dc",
    "#ff75ad",
    "#ff3d66",
    "#ff0000",
];

/**
 * @typedef {'ndvi' | 'atm'} TrendColorFamily
 * @typedef {{ lo: number, hi: number, kind: 'diverging' | 'positive' | 'negative', family: TrendColorFamily }} TrendLegendSpec
 */

/**
 * @param {'ndvi' | 'lst' | 'aod' | 'no2' | 'so2'} product
 * @returns {TrendColorFamily}
 */
export function trendFamily(product) {
    return product === "ndvi" ? "ndvi" : "atm";
}

/**
 * A partir de los límites del histograma (legend_ranges), obtiene dominio de color y tipo.
 * @param {number} rawMin
 * @param {number} rawMax
 * @returns {Omit<TrendLegendSpec, 'family'>}
 */
export function normalizeTrendSpec(rawMin, rawMax) {
    const lo0 = Number(rawMin);
    const hi0 = Number(rawMax);
    const lo = Math.min(lo0, hi0);
    const hi = Math.max(lo0, hi0);
    if (lo < 0 && hi > 0) {
        const M = Math.max(Math.abs(lo), Math.abs(hi));
        return { lo: -M, hi: M, kind: "diverging" };
    }
    if (lo >= 0) {
        return { lo, hi, kind: "positive" };
    }
    return { lo, hi, kind: "negative" };
}

/**
 * @param {'ndvi'|'lst'|'aod'|'no2'|'so2'} product
 * @param {'raster'|'zonalBarrio'|'zonalManzana'} scope
 * @returns {TrendLegendSpec | null}
 */
export function trendLegendSpec(product, scope) {
    const d = legendDomain(product, scope, "trend");
    if (!d || d.length < 2) return null;
    return { ...normalizeTrendSpec(d[0], d[1]), family: trendFamily(product) };
}

/**
 * Spec para capas zonal cuando solo se tiene el par [min,max] del dominio.
 * @param {[number, number]} domain
 * @param {'ndvi'|'lst'|'aod'|'no2'|'so2'} product
 * @returns {TrendLegendSpec | null}
 */
export function trendSpecFromDomain(domain, product) {
    if (!domain || domain.length < 2) return null;
    return { ...normalizeTrendSpec(domain[0], domain[1]), family: trendFamily(product) };
}

/**
 * @param {number} value
 * @param {TrendLegendSpec | (Omit<TrendLegendSpec, 'family'> & { family?: TrendColorFamily })} spec
 * @returns {string | null}
 */
export function trendColorFromValue(value, spec) {
    if (value == null || !Number.isFinite(value) || !spec) return null;
    const { lo, hi, kind } = spec;
    const family = spec.family ?? "ndvi";
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return null;
    if (hi === lo) {
        const stops =
            family === "atm" ? STOPS_DIVERGING_ATM : STOPS_DIVERGING_NDVI;
        return d3.interpolateRgbBasis(stops)(0.5);
    }
    const v = Math.min(hi, Math.max(lo, value));
    const t = (v - lo) / (hi - lo);

    if (kind === "diverging") {
        const stops =
            family === "atm" ? STOPS_DIVERGING_ATM : STOPS_DIVERGING_NDVI;
        return d3.interpolateRgbBasis(stops)(t);
    }
    if (kind === "positive") {
        if (family === "atm") {
            return d3.interpolateRgbBasis(STOPS_RED_LIGHT_TO_DARK)(t);
        }
        return d3.interpolateRgbBasis(STOPS_BLUE_LIGHT_TO_DARK)(t);
    }
    if (family === "atm") {
        return d3.interpolateRgbBasis(STOPS_BLUE_LIGHT_TO_DARK)(1 - t);
    }
    return d3.interpolateRgbBasis(STOPS_RED_DARK_TO_LIGHT)(t);
}

/**
 * Valor numérico en el borde inferior del paso i (para leyendas con `steps` filas).
 */
export function trendLegendBinValue(spec, steps, i) {
    const { lo, hi } = spec;
    return lo + (i * (hi - lo)) / (steps - 1);
}

/**
 * Índice de fila cuyo bin contiene 0 (para etiqueta "0" en leyendas divergentes).
 */
export function trendLegendZeroStepIndex(spec, steps) {
    if (spec.kind !== "diverging") return -1;
    const { lo, hi } = spec;
    if (lo >= 0 || hi <= 0) return -1;
    for (let i = 0; i < steps - 1; i++) {
        const a = trendLegendBinValue(spec, steps, i);
        const b = trendLegendBinValue(spec, steps, i + 1);
        if (a <= 0 && 0 <= b) return i;
    }
    return -1;
}

/**
 * SVG de leyenda tipo bloques (raster): colores y etiquetas alineados al spec normalizado.
 */
export function trendRasterLegendSvgInner(spec, steps, fmt) {
    const fmtFn =
        typeof fmt === "function"
            ? fmt
            : (x) => Number(x).toFixed(typeof fmt === "number" ? fmt : 2);
    const blockHeight = 20;
    const zeroIdx = trendLegendZeroStepIndex(spec, steps);

    const extendedColors = Array.from({ length: steps }, (_, i) => {
        const v = trendLegendBinValue(spec, steps, i);
        return trendColorFromValue(v, spec);
    });

    const legendItems = extendedColors
        .map((color, index) => {
            const yPosition = 60 + index * blockHeight;
            return `<rect x="30" y="${yPosition}" width="20" height="${blockHeight}" style="fill:${color}; stroke:#000; stroke-width:0.5" />`;
        })
        .join("");

    const valueLabels = Array.from({ length: steps }, (_, i) => {
        const value = trendLegendBinValue(spec, steps, i);
        const nextVal = trendLegendBinValue(spec, steps, i + 1);
        const yPosition = 60 + i * blockHeight + blockHeight / 2 + 5;

        if (i === 0) {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">&lt;${fmtFn(value)}</text>`;
        }
        if (i === steps - 1) {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">&gt;${fmtFn(spec.hi)}</text>`;
        }
        if (i === zeroIdx) {
            return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">0</text>`;
        }
        return `<text x="60" y="${yPosition}" font-size="10" font-family="Arial">${fmtFn(value)} – ${fmtFn(nextVal)}</text>`;
    }).join("");

    const totalHeight = blockHeight * steps;
    return { legendItems, valueLabels, totalHeight, blockHeight };
}

/**
 * Filas de leyenda HTML (paneles zonal) con rampa según ``normalizeTrendSpec``.
 */
export function fillZonalTrendLegendPanel(
    legendContent,
    titleEl,
    product,
    scope,
    options = {},
) {
    const steps = options.steps ?? 7;
    const decimals = options.decimals ?? 3;
    legendContent.appendChild(titleEl);

    const spec = trendLegendSpec(product, scope);
    if (!spec) return;

    const zeroIdx = trendLegendZeroStepIndex(spec, steps);
    const fix = (x) => x.toFixed(decimals);

    for (let index = 0; index < steps; index++) {
        const value = trendLegendBinValue(spec, steps, index);
        const color = trendColorFromValue(value, spec);
        const legendItem = document.createElement("div");
        legendItem.className = "map-legend-panel__row";

        const colorBox = document.createElement("span");
        colorBox.className = "map-legend-panel__swatch";
        colorBox.style.background = color ?? "#ccc";

        const label = document.createElement("span");
        label.className = "map-legend-panel__label";
        if (index === 0) {
            label.textContent = `<${fix(spec.lo)}`;
        } else if (index === steps - 1) {
            label.textContent = `>${fix(spec.hi)}`;
        } else if (index === zeroIdx) {
            label.textContent = "0";
        } else {
            const nextValue = trendLegendBinValue(spec, steps, index + 1);
            label.textContent = `${fix(value)} – ${fix(nextValue)}`;
        }

        legendItem.appendChild(colorBox);
        legendItem.appendChild(label);
        legendContent.appendChild(legendItem);
    }
}
