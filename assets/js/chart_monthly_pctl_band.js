/**
 * Banda semitransparente P25–P75 para series mensuales (1–12).
 */
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

/** Coincide con ``_PCT_CSV_SENTINEL`` en GEE (sin datos / fallback). */
export const GENIUS_MONTHLY_CSV_SENTINEL = -9999;

/**
 * @param {string | null | undefined} raw
 * @returns {number | null}
 */
export function geniusParseMonthlyMetric(raw) {
    if (raw == null || String(raw).trim() === "") return null;
    const v = +raw;
    if (!Number.isFinite(v)) return null;
    if (Math.abs(v - GENIUS_MONTHLY_CSV_SENTINEL) < 0.501) return null;
    return v;
}

/**
 * Rellena P25/P75 climatológicos por mes (1–12) cuando el bundle/CSV zonal solo trae la mediana:
 * cuantiles **entre años** del CSV año–mes regional (misma convención que NDVI/LST «entre años»).
 *
 * @param {Array<Record<string, unknown>>} monthlyRows — filas con ``Month`` y columnas de cuantiles
 * @param {Array<Record<string, string>> | null | undefined} ymRows
 * @param {object} opts
 * @param {string} [opts.monthKey="Month"]
 * @param {string} [opts.ymMonthKey="Month"]
 * @param {string} opts.valueKey — columna del CSV regional (p. ej. ``NO2_median``)
 * @param {string} opts.p25Key
 * @param {string} opts.p75Key
 * @param {string} [opts.medianKey] — si se rellenan P25/P75 desde regional, opcionalmente la **mediana**
 *        climatológica del mismo mes (P50 entre años), para que línea y banda compartan escala/población.
 * @param {(v: number | null) => number | null} [opts.filterValue]
 */
export function geniusFillMissingMonthlyPctlInterannualFromYearMonth(
    monthlyRows,
    ymRows,
    opts,
) {
    const rows = ymRows ?? [];
    const {
        monthKey = "Month",
        ymMonthKey = "Month",
        valueKey,
        p25Key,
        p75Key,
        medianKey = null,
        filterValue = null,
    } = opts;
    if (!monthlyRows?.length || !rows.length) return;
    if (!valueKey || !p25Key || !p75Key) return;

    /** @type {Map<number, number[]>} */
    const byCalMonth = new Map();
    for (const r of rows) {
        const mo = Math.round(+r[ymMonthKey]);
        if (mo < 1 || mo > 12) continue;
        let v = geniusParseMonthlyMetric(String(r[valueKey] ?? ""));
        if (filterValue) v = filterValue(v);
        if (v == null || !Number.isFinite(v)) continue;
        let arr = byCalMonth.get(mo);
        if (!arr) {
            arr = [];
            byCalMonth.set(mo, arr);
        }
        arr.push(v);
    }

    for (const d of monthlyRows) {
        const mo = Math.round(+d[monthKey]);
        if (mo < 1 || mo > 12) continue;
        const a = d[p25Key];
        const b = d[p75Key];
        const fa = typeof a === "number" ? a : +a;
        const fb = typeof b === "number" ? b : +b;
        const has =
            a != null &&
            b != null &&
            String(a).trim() !== "" &&
            String(b).trim() !== "" &&
            Number.isFinite(fa) &&
            Number.isFinite(fb);
        if (has) continue;
        const vals = byCalMonth.get(mo);
        if (!vals?.length) continue;
        const s = [...vals].sort((x, z) => x - z);
        let q25;
        let q75;
        if (s.length === 1) {
            q25 = s[0];
            q75 = s[0];
        } else {
            q25 = d3.quantileSorted(s, 0.25);
            q75 = d3.quantileSorted(s, 0.75);
        }
        if (q25 != null && Number.isFinite(q25)) d[p25Key] = String(q25);
        if (q75 != null && Number.isFinite(q75)) d[p75Key] = String(q75);
        if (medianKey != null && medianKey !== "") {
            const q50 =
                s.length === 1 ? s[0] : d3.quantileSorted(s, 0.5);
            if (q50 != null && Number.isFinite(q50)) d[medianKey] = String(q50);
        }
    }
}

/**
 * @param {Array<Record<string, string>>} data
 * @param {Array<{ mid: string, p25?: string, p75?: string }>} triplets
 */
export function geniusMonthlyPctlExtentMulti(data, triplets) {
    let lo = Infinity;
    let hi = -Infinity;
    for (const d of data) {
        for (const { mid, p25, p75 } of triplets) {
            const vm = geniusParseMonthlyMetric(d[mid]);
            if (vm == null) continue;
            let a = p25 ? geniusParseMonthlyMetric(d[p25]) : null;
            let b = p75 ? geniusParseMonthlyMetric(d[p75]) : null;
            if (a == null) a = vm;
            if (b == null) b = vm;
            lo = Math.min(lo, vm, a, b);
            hi = Math.max(hi, vm, a, b);
        }
    }
    if (!Number.isFinite(lo)) return [0, 1];
    return [lo, hi];
}

/**
 * @param {import('d3').Selection} svg
 * @param {object} opts
 * @param {Array<Record<string, string>>} opts.data
 * @param {(d: object) => number} opts.x — coordenada X en el mismo espacio que `y`
 * @param {import('d3').ScaleContinuousNumeric<number, number>} opts.y
 * @param {string} opts.p25Key
 * @param {string} opts.p75Key
 * @param {string} [opts.fill]
 * @param {number} [opts.fillOpacity]
 */
export function geniusAppendMonthlyPctlBand(svg, opts) {
    const {
        data,
        x,
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
            a !== "" &&
            b != null &&
            b !== "" &&
            !Number.isNaN(+a) &&
            !Number.isNaN(+b)
        );
    });
    if (!rows.length) return;
    const area = d3
        .area()
        .x((d) => x(d))
        .y0((d) => y(+d[p25Key]))
        .y1((d) => y(+d[p75Key]))
        .curve(d3.curveMonotoneX);
    svg.append("path")
        .datum(rows)
        .attr("class", "ge-monthly-pctl-band")
        .attr("fill", fill)
        .attr("fill-opacity", fillOpacity)
        .attr("stroke", "none")
        .attr("d", area);
}
