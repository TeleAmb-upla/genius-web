/**
 * Banda P25–P75 para series anuales: percentiles **intra-anuales** calculados
 * sobre los valores mensuales de cada año (CSV año–mes).
 */
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import {
    geniusParseMonthlyMetric,
    GENIUS_MONTHLY_CSV_SENTINEL,
} from "./chart_monthly_pctl_band.js";
import { geniusMonthlyClimLegendGroupY } from "./chart_layout_genius.js";
import { geniusLstSeriesYearExcluded } from "./chart_lst_series_policy.js";

/** NDVI mensual: excluye valores fuera de [-1, 1] (ruido / export inválido). */
export function geniusFilterNdviYearMonthValue(v) {
    if (v == null || !Number.isFinite(v)) return null;
    if (v < -1 || v > 1) return null;
    return v;
}

/** LST (°C): descarta valores fuera de un rango físico razonable en el pipeline. */
export function geniusFilterLstYearMonthValue(v) {
    if (v == null || !Number.isFinite(v)) return null;
    if (v < -80 || v > 100) return null;
    return v;
}

/**
 * AOD en CSV GENIUS (región): año–mes suele venir como magnitudes negativas grandes y las
 * series anuales como valores ~×100; unifica a escala de visualización coherente (~0–6).
 */
export function geniusFilterAodYearMonthValue(v) {
    if (v == null || !Number.isFinite(v)) return null;
    const x = Number(v);
    if (x >= -0.05 && x <= 6) return x;
    if (x < 0) {
        const a = Math.abs(x);
        if (a >= 500) return Math.min(6, a / 1000);
        if (a >= 100) return Math.min(6, a / 1000);
        return Math.min(6, a / 100);
    }
    if (x > 6 && x <= 150) return Math.min(6, x / 100);
    if (x > 150) return Math.min(6, x / 1000);
    return null;
}

/**
 * @param {string | null | undefined} raw
 * @returns {number | null}
 */
export function geniusParseAnnualMetric(raw) {
    if (raw == null || String(raw).trim() === "") return null;
    const v = +raw;
    if (!Number.isFinite(v)) return null;
    return v;
}

/**
 * Como ``geniusParseAnnualMetric`` pero trata el sentinela CSV (-9999) como ausencia.
 * @param {string | null | undefined} raw
 * @returns {number | null}
 */
export function geniusParseAnnualMetricOrNull(raw) {
    const v = geniusParseAnnualMetric(raw);
    if (v == null) return null;
    if (Math.abs(v - GENIUS_MONTHLY_CSV_SENTINEL) < 0.501) return null;
    return v;
}

/**
 * Asigna P25/P75 por año: si el CSV anual trae **ambos** valores válidos, se usan;
 * si faltan o son inválidos, se calculan desde el CSV año–mes (percentiles de
 * los meses válidos de ese año). Así se muestra la banda aunque GEE deje P25/P75
 * vacíos en algunas filas o años.
 *
 * @param {Array<Record<string, unknown>>} annualData
 * @param {Array<Record<string, string>> | null | undefined} ymRows
 * @param {object} opts — mismos que ``geniusApplyIntraAnnualPctlFromYearMonth`` más ``p25Key``/``p75Key``
 */
/**
 * Filas con mediana anual intra-anual finita (puntos / hover que no usan NaN).
 * @param {Array<Record<string, unknown>>} annualData
 * @param {string} medianKey
 * @returns {Array<Record<string, unknown>>}
 */
export function geniusAnnualRowsWithFiniteMedian(annualData, medianKey) {
    if (!annualData?.length) return [];
    return annualData.filter((d) => {
        const v = d[medianKey];
        const n = typeof v === "number" ? v : +v;
        return v != null && v !== "" && Number.isFinite(n);
    });
}

export function geniusEnsureOneAnnualPctlPreferCsv(annualData, ymRows, opts) {
    const {
        annualYearKey = "Year",
        ymYearKey = "Year",
        ymValueKey,
        p25Key,
        p75Key,
        filterParsedValue,
    } = opts;
    if (!annualData?.length) return;

    /** @type {Map<number, number[]>} */
    const byYear = new Map();
    if (ymRows?.length) {
        for (const r of ymRows) {
            const y = Math.round(+r[ymYearKey]);
            if (!Number.isFinite(y)) continue;
            let v = geniusParseMonthlyMetric(
                /** @type {string} */ (r[ymValueKey]),
            );
            if (filterParsedValue) v = filterParsedValue(v);
            if (v == null) continue;
            let arr = byYear.get(y);
            if (!arr) {
                arr = [];
                byYear.set(y, arr);
            }
            arr.push(v);
        }
    }

    function quantilesForYear(y) {
        const vals = byYear.get(y);
        if (!vals?.length) return { p25: null, p75: null };
        const s = [...vals].sort((a, b) => a - b);
        return {
            p25: d3.quantileSorted(s, 0.25),
            p75: d3.quantileSorted(s, 0.75),
        };
    }

    for (const d of annualData) {
        const y = Math.round(+d[annualYearKey]);
        let p25 = geniusParseAnnualMetricOrNull(
            d[p25Key] != null ? String(d[p25Key]) : "",
        );
        let p75 = geniusParseAnnualMetricOrNull(
            d[p75Key] != null ? String(d[p75Key]) : "",
        );
        if (filterParsedValue) {
            p25 = filterParsedValue(p25);
            p75 = filterParsedValue(p75);
        }
        const csvOk =
            p25 != null &&
            p75 != null &&
            Number.isFinite(+p25) &&
            Number.isFinite(+p75);
        if (!csvOk) {
            const q = quantilesForYear(y);
            p25 = q.p25;
            p75 = q.p75;
        }
        d[p25Key] = p25;
        d[p75Key] = p75;
    }
}

/**
 * Serie anual + banda P25–P75 **intra-anuales**: misma muestra (valores mensuales del CSV año–mes).
 * Si hay meses válidos para el año, mediana y cuartiles salen de ese conjunto; si no, fallback
 * desde columnas del CSV anual (P25/P75 + punto medio como mediana).
 *
 * Metodología unificada: NDVI, LST, AOD, NO₂, SO₂ (gráficos interanuales GENIUS).
 *
 * @param {Array<Record<string, unknown>>} annualData
 * @param {Array<Record<string, string>> | null | undefined} ymRows
 * @param {object} opts
 * @param {string} [opts.annualYearKey="Year"]
 * @param {string} [opts.ymYearKey="Year"]
 * @param {string} opts.ymValueKey — columna en CSV año–mes
 * @param {string} opts.medianKey — línea principal / tooltip en ``annualData``
 * @param {string} opts.p25Key
 * @param {string} opts.p75Key
 * @param {(v: number | null) => number | null} [opts.filterParsedValue]
 * @param {(year: number) => boolean} [opts.excludedYearPredicate]
 */
export function geniusApplyUrbanAnnualMedianIntraAnnualBand(
    annualData,
    ymRows,
    opts,
) {
    const {
        annualYearKey = "Year",
        ymYearKey = "Year",
        ymValueKey,
        medianKey,
        p25Key,
        p75Key,
        filterParsedValue = null,
        excludedYearPredicate = null,
    } = opts;

    if (!annualData?.length) return;
    if (
        ymValueKey == null ||
        medianKey == null ||
        p25Key == null ||
        p75Key == null
    ) {
        return;
    }

    /** @type {Map<number, number[]>} */
    const byYear = new Map();
    if (ymRows?.length) {
        for (const r of ymRows) {
            const y = Math.round(+r[ymYearKey]);
            if (!Number.isFinite(y)) continue;
            let v = geniusParseMonthlyMetric(
                /** @type {string} */ (r[ymValueKey] ?? ""),
            );
            if (filterParsedValue) v = filterParsedValue(v);
            if (v == null) continue;
            let arr = byYear.get(y);
            if (!arr) {
                arr = [];
                byYear.set(y, arr);
            }
            arr.push(v);
        }
    }

    for (const d of annualData) {
        const y = Math.round(+d[annualYearKey]);
        if (!Number.isFinite(y)) continue;
        const vals = byYear.get(y);
        if (vals?.length) {
            const s = [...vals].sort((a, b) => a - b);
            d[p25Key] = d3.quantileSorted(s, 0.25);
            d[medianKey] = d3.quantileSorted(s, 0.5);
            d[p75Key] = d3.quantileSorted(s, 0.75);
        } else {
            let p25 = geniusParseAnnualMetricOrNull(
                d[p25Key] != null ? String(d[p25Key]) : "",
            );
            let p75 = geniusParseAnnualMetricOrNull(
                d[p75Key] != null ? String(d[p75Key]) : "",
            );
            if (filterParsedValue) {
                p25 = filterParsedValue(p25);
                p75 = filterParsedValue(p75);
            }
            d[p25Key] = p25;
            d[p75Key] = p75;
            if (
                p25 != null &&
                p75 != null &&
                Number.isFinite(p25) &&
                Number.isFinite(p75)
            ) {
                d[medianKey] = (p25 + p75) / 2;
            } else {
                d[medianKey] = null;
            }
        }
    }

    if (typeof excludedYearPredicate === "function") {
        for (const d of annualData) {
            const y = Math.round(+d[annualYearKey]);
            if (!excludedYearPredicate(y)) continue;
            d[medianKey] = null;
            d[p25Key] = null;
            d[p75Key] = null;
        }
    }
}

/**
 * LST anual urbano: mismo núcleo que ``geniusApplyUrbanAnnualMedianIntraAnnualBand``
 * más años excluidos de serie (p. ej. 2012).
 */
export function geniusApplyLstUrbanAnnualMedianIntraAnnualBand(
    annualData,
    ymRows,
    opts = {},
) {
    geniusApplyUrbanAnnualMedianIntraAnnualBand(annualData, ymRows, {
        ymValueKey: "LST_mean",
        medianKey: "LST_median",
        p25Key: "LST_p25",
        p75Key: "LST_p75",
        filterParsedValue: geniusFilterLstYearMonthValue,
        excludedYearPredicate: geniusLstSeriesYearExcluded,
        ...opts,
    });
}

/**
 * Asigna P25/P75 por fila anual a partir de todos los meses válidos de ese año
 * en `ymRows` (misma convención de sentinela que los mensuales).
 * Si no hay año–mes o un año no tiene datos, `p25Key`/`p75Key` quedan en null.
 *
 * @param {Array<Record<string, unknown>>} annualData
 * @param {Array<Record<string, string>> | null | undefined} ymRows
 * @param {object} opts
 * @param {string} [opts.annualYearKey="Year"]
 * @param {string} [opts.ymYearKey="Year"]
 * @param {string} opts.ymValueKey
 * @param {string} opts.p25Key
 * @param {string} opts.p75Key
 * @param {(v: number | null) => number | null} [opts.filterParsedValue] — p. ej. NDVI ∈ [-1,1]
 */
export function geniusApplyIntraAnnualPctlFromYearMonth(
    annualData,
    ymRows,
    opts,
) {
    const {
        annualYearKey = "Year",
        ymYearKey = "Year",
        ymValueKey,
        p25Key,
        p75Key,
        filterParsedValue,
    } = opts;
    if (!annualData?.length) return;

    /** @type {Map<number, number[]>} */
    const byYear = new Map();
    if (ymRows?.length) {
        for (const r of ymRows) {
            const y = Math.round(+r[ymYearKey]);
            if (!Number.isFinite(y)) continue;
            let v = geniusParseMonthlyMetric(
                /** @type {string} */ (r[ymValueKey]),
            );
            if (filterParsedValue) v = filterParsedValue(v);
            if (v == null) continue;
            let arr = byYear.get(y);
            if (!arr) {
                arr = [];
                byYear.set(y, arr);
            }
            arr.push(v);
        }
    }

    for (const d of annualData) {
        const y = Math.round(+d[annualYearKey]);
        const vals = byYear.get(y);
        if (!vals?.length) {
            d[p25Key] = null;
            d[p75Key] = null;
            continue;
        }
        const s = [...vals].sort((a, b) => a - b);
        d[p25Key] = d3.quantileSorted(s, 0.25);
        d[p75Key] = d3.quantileSorted(s, 0.75);
    }
}

/**
 * Rellena solo filas anuales que **no** tienen ya P25/P75 finitos (p. ej. explorador zonal por barrio),
 * usando cuartiles intra-anuales del CSV año–mes regional.
 *
 * @param {Array<Record<string, unknown>>} annualRows
 * @param {Array<Record<string, string>> | null | undefined} ymRows
 * @param {object} opts
 * @param {string} [opts.annualYearKey="Year"]
 * @param {string} [opts.ymYearKey="Year"]
 * @param {string} opts.ymValueKey
 * @param {string} opts.p25Key
 * @param {string} opts.p75Key
 * @param {string} [opts.medianKey] — si se rellenan P25/P75 desde año–mes, también fija la mediana (misma muestra intra-anual).
 * @param {(v: number | null) => number | null} [opts.filterValue]
 */
export function geniusFillMissingAnnualPctlFromYearMonth(
    annualRows,
    ymRows,
    opts,
) {
    const {
        annualYearKey = "Year",
        ymYearKey = "Year",
        ymValueKey,
        p25Key,
        p75Key,
        medianKey = null,
        filterValue = null,
    } = opts;
    if (!annualRows?.length || !ymRows?.length) return;
    if (!ymValueKey || !p25Key || !p75Key) return;

    /** @type {Map<number, number[]>} */
    const byYear = new Map();
    for (const r of ymRows) {
        const y = Math.round(+r[ymYearKey]);
        if (!Number.isFinite(y)) continue;
        let v = geniusParseMonthlyMetric(String(r[ymValueKey] ?? ""));
        if (filterValue) v = filterValue(v);
        if (v == null || !Number.isFinite(v)) continue;
        let arr = byYear.get(y);
        if (!arr) {
            arr = [];
            byYear.set(y, arr);
        }
        arr.push(v);
    }

    for (const d of annualRows) {
        const y = Math.round(+d[annualYearKey]);
        if (!Number.isFinite(y)) continue;
        const a = d[p25Key];
        const b = d[p75Key];
        const fa = typeof a === "number" ? a : +a;
        const fb = typeof b === "number" ? b : +b;
        const has =
            a != null &&
            b != null &&
            a !== "" &&
            b !== "" &&
            Number.isFinite(fa) &&
            Number.isFinite(fb);
        if (has) continue;
        const vals = byYear.get(y);
        if (!vals?.length) continue;
        const s = [...vals].sort((x, z) => x - z);
        d[p25Key] = d3.quantileSorted(s, 0.25);
        d[p75Key] = d3.quantileSorted(s, 0.75);
        if (medianKey != null && medianKey !== "") {
            d[medianKey] = d3.quantileSorted(s, 0.5);
        }
    }
}

/**
 * @param {Array<Record<string, unknown>>} data
 * @param {string} midKey
 * @param {string} p25Key
 * @param {string} p75Key
 * @returns {[number, number]}
 */
export function geniusAnnualPctlYExtent(data, midKey, p25Key, p75Key) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const d of data) {
        for (const k of [midKey, p25Key, p75Key]) {
            const v = typeof d[k] === "number" ? d[k] : +d[k];
            if (v != null && Number.isFinite(v)) {
                lo = Math.min(lo, v);
                hi = Math.max(hi, v);
            }
        }
    }
    if (!Number.isFinite(lo)) return [0, 1];
    return [lo, hi];
}

/**
 * @param {import('d3').Selection} svg
 * @param {object} opts
 * @param {Array<Record<string, unknown>>} opts.data
 * @param {import('d3').ScaleBand<string | number>} opts.xBand
 * @param {string} opts.yearKey
 * @param {import('d3').ScaleContinuousNumeric<number, number>} opts.y
 * @param {string} opts.p25Key
 * @param {string} opts.p75Key
 * @param {string} [opts.fill]
 * @param {number} [opts.fillOpacity]
 */
export function geniusAppendAnnualPctlBand(svg, opts) {
    const {
        data,
        xBand,
        yearKey,
        y,
        p25Key,
        p75Key,
        fill = "steelblue",
        fillOpacity = 0.22,
    } = opts;
    const rows = data.filter((d) => {
        const a = d[p25Key];
        const b = d[p75Key];
        return (
            a != null &&
            b != null &&
            Number.isFinite(+a) &&
            Number.isFinite(+b)
        );
    });
    if (!rows.length) return;
    const xCenter = (d) => xBand(d[yearKey]) + xBand.bandwidth() / 2;
    const area = d3
        .area()
        .x((d) => xCenter(d))
        .y0((d) => y(+d[p25Key]))
        .y1((d) => y(+d[p75Key]))
        .curve(d3.curveMonotoneX);
    svg.append("path")
        .datum(rows)
        .attr("class", "ge-annual-pctl-band")
        .attr("fill", fill)
        .attr("fill-opacity", fillOpacity)
        .attr("stroke", "none")
        .attr("d", area);
}

/**
 * Leyenda mediana anual + banda P25–P75 intra-anual.
 * @param {import('d3').Selection} svg — grupo interior tras márgenes
 * @param {object} opts
 * @param {number} opts.innerHeight — borde inferior del área de trazo
 * @param {string} [opts.lineColor]
 * @param {string} [opts.bandFillColor]
 * @param {string} [opts.medianLabel]
 * @param {string} [opts.bandLabel]
 * @param {{ label: string, color?: string } | null} [opts.meanLine] — segunda serie (típico: media vs mediana)
 */
export function geniusAppendAnnualSeriesLegend(svg, opts) {
    const {
        innerHeight: plotBottom,
        lineColor = "steelblue",
        bandFillColor = "steelblue",
        medianLabel = "Mediana anual",
        bandLabel = "P25–P75 intra-anual (meses)",
        meanLine = null,
    } = opts;
    const fs = "10px";
    const font = "Arial, sans-serif";
    const g = svg
        .append("g")
        .attr("class", "ge-annual-series-legend")
        .attr(
            "transform",
            `translate(0,${geniusMonthlyClimLegendGroupY(plotBottom)})`,
        );
    let x = 0;
    const y = 0;
    const sep = 14;

    g.append("line")
        .attr("x1", x)
        .attr("x2", x + 20)
        .attr("y1", y)
        .attr("y2", y)
        .attr("stroke", lineColor)
        .attr("stroke-width", 1.6);
    g.append("circle")
        .attr("cx", x + 10)
        .attr("cy", y)
        .attr("r", 2.8)
        .attr("fill", lineColor);
    g.append("text")
        .attr("x", x + 26)
        .attr("y", y + 4)
        .attr("text-anchor", "start")
        .style("font-size", fs)
        .style("font-family", font)
        .text(medianLabel);
    x += 26 + 148 + sep;

    g.append("rect")
        .attr("x", x)
        .attr("y", y - 5)
        .attr("width", 22)
        .attr("height", 10)
        .attr("fill", bandFillColor)
        .attr("fill-opacity", 0.22)
        .attr("stroke", "none");
    g.append("text")
        .attr("x", x + 28)
        .attr("y", y + 4)
        .attr("text-anchor", "start")
        .style("font-size", fs)
        .style("font-family", font)
        .text(bandLabel);

    if (meanLine != null && meanLine.label) {
        const y2 = 18;
        const mcol = meanLine.color ?? "#1f4e79";
        let mx = 0;
        g.append("line")
            .attr("x1", mx)
            .attr("x2", mx + 20)
            .attr("y1", y2)
            .attr("y2", y2)
            .attr("stroke", mcol)
            .attr("stroke-width", 1.6)
            .attr("stroke-dasharray", "4 3");
        g.append("circle")
            .attr("cx", mx + 10)
            .attr("cy", y2)
            .attr("r", 2.8)
            .attr("fill", mcol);
        g.append("text")
            .attr("x", mx + 26)
            .attr("y", y2 + 4)
            .attr("text-anchor", "start")
            .style("font-size", fs)
            .style("font-family", font)
            .text(meanLine.label);
    }
}
