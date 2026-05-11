/**
 * Exploración LST por barrio: mismos tipos de gráfico que el área urbana,
 * desde GeoJSON zonales de barrios y CSV asociados (bundle JSON + GEE).
 */
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { getProductYears } from "../map_data_catalog.js";
import {
    getGeniusChartLayout,
    GENIUS_CHART_HEADING_CLASS,
    geniusAnnualAxisTitleY,
    geniusAnnualSeriesLegendMinBottom,
    geniusMonthlyClimAxisTitleY,
    geniusMonthlyClimMinBottom,
    geniusConfigureAnnualBandYearAxis,
} from "../chart_layout_genius.js";
import {
    geniusAppendMonthlyPctlBand,
    geniusMonthlyPctlExtentMulti,
    geniusParseMonthlyMetric,
} from "../chart_monthly_pctl_band.js";
import {
    geniusAppendAnioActualLine,
    geniusAppendMonthlyClimatologyLegend,
    geniusExpandDomainWithPoints,
    geniusFetchYearMonthCsvOptional,
    geniusResolveAnioActualSeries,
    geniusWallCalendarYearMonth,
    GENIUS_ANIO_ACTUAL_CSV_KEY,
    GENIUS_YEARMONTH_CSV,
} from "../chart_monthly_estado_actual.js";
import {
    geniusAnnualPctlYExtent,
    geniusAppendAnnualPctlBand,
    geniusAppendAnnualSeriesLegend,
    geniusFilterLstYearMonthValue,
    geniusParseAnnualMetricOrNull,
} from "../chart_annual_pctl_band.js";
import {
    GENIUS_LST_NULL_SERIES_YEARS,
    geniusLstSeriesYearExcluded,
} from "../chart_lst_series_policy.js";
import { GENIUS_MONTHLY_ANIO_COLOR } from "../chart_variable_accent.js";
import { geniusBindNearestPointHover } from "../chart_tooltip_genius.js";

/** Climatología / mediana / banda P25–P75 (misma convención que NDVI zonal: steelblue). */
const LST_CLIM_STEEL = "steelblue";

const YEARLY_BARIOS =
    "assets/data/geojson/LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Barrios/LST_Yearly_ZonalStats_Barrios";
const MONTHLY_BARIOS =
    "assets/data/geojson/LST/LST_Monthly_ZonalStats/LST_Monthly_ZonalStats_Barrios/LST_Monthly_ZonalStats_Barrios";

/** JSON generado por ``scripts/repo/bundles/build_lst_zonal_explorer_bundle.py``. */
const LST_ZONAL_EXPLORER_BAR = "assets/data/csv/LST_zonal_explorer_barrios.json";

const LST_M_ZONAL_BAR = "assets/data/csv/LST_m_zonal_barrios.csv";

const LST_Y_ZONAL_BAR = "assets/data/csv/LST_y_zonal_barrios.csv";

let lstExplorerHostInstalled = false;
let _zonalExplorerBundleBar;
let _mZonalBarCache;
let _yZonalBarCache;

function esc(s) {
    return String(s ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function matchBarrio(feat, nombre) {
    const n = String(nombre ?? "").trim();
    const p = feat?.properties;
    if (!p || p.NOMBRE == null) return false;
    return String(p.NOMBRE).trim() === n;
}

async function fetchJson(url) {
    const r = await fetch(url);
    if (!r.ok) return null;
    return r.json();
}

/**
 * @returns {Promise<Array<{ Year: number, LST_median: number, LST_p25: number | null, LST_p75: number | null }>>}
 */
async function fetchLstZonalAnnualSeries(barrioNombre) {
    const years = getProductYears("lst");
    const base = YEARLY_BARIOS;
    const payloads = await Promise.all(
        years.map(async (y) => {
            const url = resolveAssetUrl(`${base}_${y}.geojson`);
            const gj = await fetchJson(url);
            if (!gj?.features?.length) return null;
            const feat = gj.features.find((f) => matchBarrio(f, barrioNombre));
            if (!feat?.properties) return null;
            const v = feat.properties.LST_mean;
            if (v == null || v === "") return null;
            const num = +v;
            if (!Number.isFinite(num)) return null;
            const f = geniusFilterLstYearMonthValue(num);
            if (f == null) return null;
            let p25 = null;
            let p75 = null;
            const raw25 = feat.properties.LST_p25;
            const raw75 = feat.properties.LST_p75;
            if (raw25 != null && String(raw25).trim() !== "") {
                const p = geniusParseAnnualMetricOrNull(String(raw25).trim());
                p25 = p != null ? geniusFilterLstYearMonthValue(p) : null;
            }
            if (raw75 != null && String(raw75).trim() !== "") {
                const p = geniusParseAnnualMetricOrNull(String(raw75).trim());
                p75 = p != null ? geniusFilterLstYearMonthValue(p) : null;
            }
            return {
                Year: +y,
                LST_median: f,
                LST_p25: p25,
                LST_p75: p75,
            };
        }),
    );
    return payloads.filter(Boolean).sort((a, b) => a.Year - b.Year);
}

/**
 * Mediana climatológica por mes desde GeoJSON (12 capas); sin percentiles ni año–mes.
 * @returns {Promise<Array<Record<string,string>>>}
 */
async function fetchLstZonalMonthlyRowsGeojson(barrioNombre) {
    const base = MONTHLY_BARIOS;
    const rows = [];
    for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, "0");
        const url = resolveAssetUrl(`${base}_${mm}.geojson`);
        const gj = await fetchJson(url);
        let lst = null;
        if (gj?.features?.length) {
            const feat = gj.features.find((f) => matchBarrio(f, barrioNombre));
            if (feat?.properties && feat.properties.LST_mean != null && feat.properties.LST_mean !== "") {
                const num = +feat.properties.LST_mean;
                if (Number.isFinite(num)) lst = num;
            }
        }
        rows.push({
            Month: String(m),
            LST_mean: lst != null ? String(lst) : "",
            LST_p25: "",
            LST_p75: "",
        });
    }
    return rows;
}

async function loadLstMZonalCsv() {
    if (_mZonalBarCache !== undefined) return _mZonalBarCache;
    const url =
        typeof resolveAssetUrl === "function"
            ? resolveAssetUrl(LST_M_ZONAL_BAR)
            : LST_M_ZONAL_BAR;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            _mZonalBarCache = [];
            return [];
        }
        const text = await res.text();
        _mZonalBarCache = d3.csvParse(text);
        return _mZonalBarCache;
    } catch {
        _mZonalBarCache = [];
        return [];
    }
}

function filterZonalMonthlyForEntity(allRows, nombreBarrio) {
    const idt = String(nombreBarrio ?? "").trim();
    return allRows.filter((r) => String(r.NOMBRE ?? "").trim() === idt);
}

/**
 * Une CSV mensual GEE (``LST_m_zonal_*``) con fallback GeoJSON por mes.
 * @returns {Array<Record<string,string>>}
 */
async function loadLstYZonalCsv() {
    if (_yZonalBarCache !== undefined) return _yZonalBarCache;
    const url =
        typeof resolveAssetUrl === "function"
            ? resolveAssetUrl(LST_Y_ZONAL_BAR)
            : LST_Y_ZONAL_BAR;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            _yZonalBarCache = [];
            return [];
        }
        const text = await res.text();
        _yZonalBarCache = d3.csvParse(text);
        return _yZonalBarCache;
    } catch {
        _yZonalBarCache = [];
        return [];
    }
}

/**
 * @param {Array<{ Year: number, LST_median: number, LST_p25: number | null, LST_p75: number | null }>} annualPoints
 * @param {Array<Record<string, string>>} entityCsvRows
 */
function mergeZonalAnnualFromEngineCsv(annualPoints, entityCsvRows) {
    if (!entityCsvRows?.length) return annualPoints;
    const byYear = new Map();
    for (const r of entityCsvRows) {
        const y = Math.round(+r.Year);
        if (!Number.isFinite(y)) continue;
        byYear.set(y, r);
    }
    const out = annualPoints.map((p) => {
        const c = byYear.get(p.Year);
        if (!c) return p;
        let mid = p.LST_median;
        if (c.LST_mean != null && String(c.LST_mean).trim() !== "") {
            const v = geniusFilterLstYearMonthValue(+c.LST_mean);
            if (v != null) mid = v;
        }
        let p25 = p.LST_p25;
        let p75 = p.LST_p75;
        if (c.LST_p25 != null && String(c.LST_p25).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(c.LST_p25).trim());
            p25 = parsed != null ? geniusFilterLstYearMonthValue(parsed) : null;
        }
        if (c.LST_p75 != null && String(c.LST_p75).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(c.LST_p75).trim());
            p75 = parsed != null ? geniusFilterLstYearMonthValue(parsed) : null;
        }
        return { Year: p.Year, LST_median: mid, LST_p25: p25, LST_p75: p75 };
    });
    const seen = new Set(out.map((p) => p.Year));
    for (const r of entityCsvRows) {
        const y = Math.round(+r.Year);
        if (!Number.isFinite(y) || seen.has(y)) continue;
        let mid = null;
        if (r.LST_mean != null && String(r.LST_mean).trim() !== "") {
            mid = geniusFilterLstYearMonthValue(+r.LST_mean);
        }
        if (mid == null) continue;
        let p25 = null;
        let p75 = null;
        if (r.LST_p25 != null && String(r.LST_p25).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(r.LST_p25).trim());
            p25 = parsed != null ? geniusFilterLstYearMonthValue(parsed) : null;
        }
        if (r.LST_p75 != null && String(r.LST_p75).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(r.LST_p75).trim());
            p75 = parsed != null ? geniusFilterLstYearMonthValue(parsed) : null;
        }
        out.push({ Year: y, LST_median: mid, LST_p25: p25, LST_p75: p75 });
        seen.add(y);
    }
    for (const p of out) {
        if (!geniusLstSeriesYearExcluded(p.Year)) continue;
        p.LST_median = NaN;
        p.LST_p25 = null;
        p.LST_p75 = null;
    }
    out.sort((a, b) => a.Year - b.Year);
    return out;
}

function mergeZonalMonthlyFromEngineCsv(entityRows, geoRows) {
    const byMonth = new Map();
    for (const r of entityRows) {
        const mo = Math.round(+r.Month);
        if (mo >= 1 && mo <= 12) byMonth.set(mo, r);
    }
    const out = [];
    for (let m = 1; m <= 12; m++) {
        const csv = byMonth.get(m);
        const geo = geoRows[m - 1];
        if (csv) {
            out.push({
                Month: String(m),
                LST_mean: csv.LST_mean != null ? String(csv.LST_mean).trim() : "",
                LST_p25: csv.LST_p25 != null ? String(csv.LST_p25).trim() : "",
                LST_p75: csv.LST_p75 != null ? String(csv.LST_p75).trim() : "",
                anio_actual:
                    csv.anio_actual != null ? String(csv.anio_actual).trim() : "",
            });
        } else {
            out.push({
                Month: String(m),
                LST_mean:
                    geo?.LST_mean != null && String(geo.LST_mean).trim() !== ""
                        ? String(geo.LST_mean)
                        : "",
                LST_p25: "",
                LST_p75: "",
                anio_actual: "",
            });
        }
    }
    return out;
}

/**
 * Climatología mensual: prioriza CSV GEE zonal si existe.
 * @returns {Promise<{ rows: Array<Record<string,string>> }>}
 */
export async function fetchLstZonalMonthlyCharts(barrioNombre) {
    const geoRows = await fetchLstZonalMonthlyRowsGeojson(barrioNombre);
    const all = await loadLstMZonalCsv();
    const entityRows = filterZonalMonthlyForEntity(all, barrioNombre);
    if (!entityRows.length) {
        return { rows: geoRows };
    }
    return { rows: mergeZonalMonthlyFromEngineCsv(entityRows, geoRows) };
}

async function loadZonalExplorerBundle() {
    if (_zonalExplorerBundleBar !== undefined) return _zonalExplorerBundleBar;
    const url =
        typeof resolveAssetUrl === "function"
            ? resolveAssetUrl(LST_ZONAL_EXPLORER_BAR)
            : LST_ZONAL_EXPLORER_BAR;
    try {
        const r = await fetch(url);
        if (!r.ok) {
            _zonalExplorerBundleBar = null;
            return null;
        }
        const j = await r.json();
        const b = j?.entities ? j : null;
        _zonalExplorerBundleBar = b;
        return b;
    } catch {
        _zonalExplorerBundleBar = null;
        return null;
    }
}

function getZonalBundleEntity(bundle, id) {
    if (!bundle?.entities) return null;
    const k = String(id ?? "").trim();
    return bundle.entities[k] ?? null;
}

function annualBundleToChart(annual) {
    if (!Array.isArray(annual)) return [];
    return annual
        .map((r) => {
            const y = +r.Year;
            let mid = +r.LST_mean;
            if (!Number.isFinite(mid)) mid = NaN;
            mid = geniusFilterLstYearMonthValue(mid);
            const midPlot =
                mid != null && Number.isFinite(mid) ? mid : NaN;
            let p25 =
                r.LST_p25 != null && String(r.LST_p25).trim() !== ""
                    ? geniusParseAnnualMetricOrNull(String(r.LST_p25))
                    : null;
            let p75 =
                r.LST_p75 != null && String(r.LST_p75).trim() !== ""
                    ? geniusParseAnnualMetricOrNull(String(r.LST_p75))
                    : null;
            p25 = geniusFilterLstYearMonthValue(p25);
            p75 = geniusFilterLstYearMonthValue(p75);
            return { Year: y, LST_median: midPlot, LST_p25: p25, LST_p75: p75 };
        })
        .filter((r) => Number.isFinite(r.Year));
}

function monthlyBundleToRawRows(monthly) {
    if (!Array.isArray(monthly)) return [];
    return monthly.map((r) => ({
        Month: String(r.Month),
        LST_mean: r.LST_mean != null ? String(r.LST_mean) : "",
        LST_p25: r.LST_p25 != null ? String(r.LST_p25) : "",
        LST_p75: r.LST_p75 != null ? String(r.LST_p75) : "",
        anio_actual: r.anio_actual != null ? String(r.anio_actual) : "",
    }));
}

/**
 * @returns {Promise<{ annual: Array<{Year:number,LST_median:number}>, monthlyRows: Array<Record<string,string>> }>}
 */
export async function fetchLstZonalExplorerData(barrioNombre) {
    const [bundle, yCsvAll] = await Promise.all([
        loadZonalExplorerBundle(),
        loadLstYZonalCsv(),
    ]);
    const zonalYears = new Set(getProductYears("lst"));
    for (const y of GENIUS_LST_NULL_SERIES_YEARS) zonalYears.add(y);
    const entityY = filterZonalMonthlyForEntity(yCsvAll, barrioNombre).filter((r) =>
        zonalYears.has(Math.round(+r.Year)),
    );

    const ent = getZonalBundleEntity(bundle, barrioNombre);
    let annual;
    let monthlyRows;
    if (ent) {
        annual = annualBundleToChart(ent.annual).filter((p) => zonalYears.has(p.Year));
        monthlyRows = monthlyBundleToRawRows(ent.monthly);
    } else {
        const [annualGeo, monthly] = await Promise.all([
            fetchLstZonalAnnualSeries(barrioNombre),
            fetchLstZonalMonthlyCharts(barrioNombre),
        ]);
        annual = annualGeo;
        monthlyRows = monthly.rows;
    }

    const annualMerged =
        entityY.length > 0 ? mergeZonalAnnualFromEngineCsv(annual, entityY) : annual;
    return { annual: annualMerged, monthlyRows };
}

function renderAnnualChart(container, data, titleText) {
    d3.select(container).selectAll("*").remove();
    if (!data?.length) {
        d3.select(container).append("p").text("Sin serie anual para esta entidad.");
        return;
    }
    const { width, height, margin: m0 } = getGeniusChartLayout(container);
    const margin = {
        ...m0,
        bottom: Math.max(m0.bottom, geniusAnnualSeriesLegendMinBottom()),
    };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
        .select(container)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    svg
        .append("text")
        .attr("x", innerWidth / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("font-family", "Arial")
        .attr("class", GENIUS_CHART_HEADING_CLASS)
        .text(titleText);

    svg
        .append("text")
        .attr("text-anchor", "middle")
        .attr("x", innerWidth / 2)
        .attr("y", geniusAnnualAxisTitleY(innerHeight))
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Años");

    svg
        .append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -Math.max(42, Math.round(margin.left * 0.78)))
        .attr("x", -innerHeight / 2)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("LST (°C)");

    const [minNDVI, maxNDVI] = geniusAnnualPctlYExtent(
        data,
        "LST_median",
        "LST_p25",
        "LST_p75",
    );

    const x = d3
        .scaleBand()
        .domain(data.map((d) => d.Year))
        .range([0, innerWidth]);

    const xAxisG = svg.append("g").attr(
        "transform",
        `translate(0,${innerHeight})`,
    );
    geniusConfigureAnnualBandYearAxis(xAxisG, x);

    const y = d3
        .scaleLinear()
        .domain([minNDVI - 0.01, maxNDVI + 0.01])
        .range([innerHeight, 0]);
    svg.append("g").call(d3.axisLeft(y));

    geniusAppendAnnualSeriesLegend(svg, {
        innerHeight,
        lineColor: LST_CLIM_STEEL,
        bandFillColor: LST_CLIM_STEEL,
        medianLabel: "Mediana anual",
    });

    geniusAppendAnnualPctlBand(svg, {
        data,
        xBand: x,
        yearKey: "Year",
        y,
        p25Key: "LST_p25",
        p75Key: "LST_p75",
        fill: LST_CLIM_STEEL,
    });

    const annualHoverPts = data.filter((d) => Number.isFinite(d.LST_median));

    const line = d3
        .line()
        .defined((d) => Number.isFinite(d.LST_median))
        .x((d) => x(d.Year) + x.bandwidth() / 2)
        .y((d) => y(d.LST_median))
        .curve(d3.curveCatmullRom.alpha(0.5));

    const path = svg
        .append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", LST_CLIM_STEEL)
        .attr("stroke-width", 1.5)
        .attr("d", line);
    const len = path.node().getTotalLength();
    path
        .attr("stroke-dasharray", `${len} ${len}`)
        .attr("stroke-dashoffset", len)
        .transition()
        .duration(1800)
        .ease(d3.easeLinear)
        .attr("stroke-dashoffset", 0);

    svg.append("g")
        .selectAll("circle")
        .data(annualHoverPts)
        .enter()
        .append("circle")
        .attr("cx", (d) => x(d.Year) + x.bandwidth() / 2)
        .attr("cy", (d) => y(d.LST_median))
        .attr("r", 4)
        .attr("fill", LST_CLIM_STEEL)
        .attr("pointer-events", "none");

    const tooltip = d3
        .select(container)
        .append("div")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px")
        .style("position", "absolute")
        .style("pointer-events", "none");

    geniusBindNearestPointHover(svg, {
        panelId: container.id || "lst-explorer-annual",
        innerWidth,
        innerHeight,
        tooltip,
        points: annualHoverPts.map((d) => ({
            cx: x(d.Year) + x.bandwidth() / 2,
            cy: y(d.LST_median),
            row: d,
            kind: "y",
        })),
        html: (p) => {
            const r = p.row;
            let s = `Año: ${r.Year}<br>LST (P50 intra-anual): ${
                Number.isFinite(r.LST_median)
                    ? r.LST_median.toFixed(2) + " °C"
                    : "—"
            }`;
            if (
                r.LST_p25 != null &&
                r.LST_p75 != null &&
                Number.isFinite(+r.LST_p25) &&
                Number.isFinite(+r.LST_p75)
            ) {
                s += `<br>P25–P75: ${(+r.LST_p25).toFixed(2)} – ${(+r.LST_p75).toFixed(2)}`;
            }
            return s;
        },
    });
}

async function renderMonthlyChart(container, rawRows, titleText) {
    d3.select(container).selectAll("*").remove();
    const data = rawRows.map((d) => ({ ...d }));
    data.forEach((d) => {
        d.Month = +d.Month;
        const vm = geniusParseMonthlyMetric(d.LST_mean);
        d.LST_median = vm != null ? vm : NaN;
        if (d.LST_p25 != null && String(d.LST_p25).trim() !== "")
            d.LST_p25 = geniusParseMonthlyMetric(String(d.LST_p25));
        else d.LST_p25 = null;
        if (d.LST_p75 != null && String(d.LST_p75).trim() !== "")
            d.LST_p75 = geniusParseMonthlyMetric(String(d.LST_p75));
        else d.LST_p75 = null;
    });

    const { width, height, margin: m0 } = getGeniusChartLayout(container);
    const margin = { ...m0, bottom: Math.max(m0.bottom, geniusMonthlyClimMinBottom()) };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const svg = d3
        .select(container)
        .append("svg")
        .attr("viewBox", `0 0 ${width} ${height}`)
        .attr("preserveAspectRatio", "xMidYMid meet")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    svg
        .append("text")
        .attr("x", innerWidth / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("font-family", "Arial")
        .attr("class", GENIUS_CHART_HEADING_CLASS)
        .text(titleText);

    svg
        .append("text")
        .attr("text-anchor", "middle")
        .attr("x", innerWidth / 2)
        .attr("y", geniusMonthlyClimAxisTitleY(innerHeight))
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Meses");

    svg
        .append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -Math.max(42, Math.round(margin.left * 0.78)))
        .attr("x", -innerHeight / 2)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("LST (°C)");

    const wall = geniusWallCalendarYearMonth();
    const ymRows = await geniusFetchYearMonthCsvOptional(GENIUS_YEARMONTH_CSV.lstUrban);
    const [minNDVI0, maxNDVI0] = geniusMonthlyPctlExtentMulti(data, [
        { mid: "LST_median", p25: "LST_p25", p75: "LST_p75" },
    ]);
    const anioActual = geniusResolveAnioActualSeries({
        monthlyData: data,
        anioKey: GENIUS_ANIO_ACTUAL_CSV_KEY,
        ymRows,
        ymKeys: { yearKey: "Year", monthKey: "Month", valueKey: "LST_mean" },
        wall,
        lstExcludedYearSlotsPredicate: geniusLstSeriesYearExcluded,
    });
    const anioHasValues = anioActual.points.some(
        (p) => p.v != null && Number.isFinite(p.v),
    );
    const anioColor = GENIUS_MONTHLY_ANIO_COLOR.lst;
    const [minNDVI, maxNDVI] = geniusExpandDomainWithPoints(
        minNDVI0,
        maxNDVI0,
        anioActual.points.map((p) => p.v),
    );

    const x = d3.scaleLinear().domain([1, 12]).range([0, innerWidth]);
    svg
        .append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(12).tickFormat(d3.format("d")));

    const y = d3.scaleLinear().domain([minNDVI - 0.01, maxNDVI + 0.01]).range([innerHeight, 0]);
    svg.append("g").call(d3.axisLeft(y));

    geniusAppendMonthlyClimatologyLegend(svg, {
        innerWidth,
        innerHeight,
        placement: "belowAxis",
        climColor: LST_CLIM_STEEL,
        bandFillColor: LST_CLIM_STEEL,
        bandPctlLabel: "P25–P75 entre años (media zonal)",
        anioColor: anioHasValues ? anioColor : null,
        anioYear: anioHasValues ? anioActual.year : null,
    });

    geniusAppendMonthlyPctlBand(svg, {
        data,
        x: (d) => x(d.Month),
        y,
        p25Key: "LST_p25",
        p75Key: "LST_p75",
        fill: LST_CLIM_STEEL,
        fillOpacity: 0.22,
    });

    const line = d3
        .line()
        .defined((d) => Number.isFinite(d.LST_median))
        .x((d) => x(d.Month))
        .y((d) => y(d.LST_median))
        .curve(d3.curveCatmullRom.alpha(0.5));

    const path = svg.append("path").datum(data.filter((d) => Number.isFinite(d.LST_median))).attr("fill", "none").attr("stroke", LST_CLIM_STEEL).attr("stroke-width", 1.5).attr("d", line);
    const node = path.node();
    if (node) {
        const totalLength = node.getTotalLength();
        path
            .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
            .attr("stroke-dashoffset", totalLength)
            .transition()
            .duration(1800)
            .ease(d3.easeLinear)
            .attr("stroke-dashoffset", 0);
    }

    geniusAppendAnioActualLine(svg, {
        xPos: (d) => x(d.Month),
        y,
        points: anioActual.points,
        color: anioColor,
    });

    svg.append("g")
        .selectAll("circle")
        .data(data.filter((d) => Number.isFinite(d.LST_median)))
        .enter()
        .append("circle")
        .attr("cx", (d) => x(d.Month))
        .attr("cy", (d) => y(d.LST_median))
        .attr("r", 4)
        .attr("fill", LST_CLIM_STEEL)
        .attr("pointer-events", "none");

    const tooltip = d3
        .select(container)
        .append("div")
        .style("opacity", 0)
        .attr("class", "tooltip")
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px")
        .style("position", "absolute")
        .style("pointer-events", "none");

    const hoverClim = data
        .filter((d) => Number.isFinite(d.LST_median))
        .map((d) => ({
            cx: x(d.Month),
            cy: y(d.LST_median),
            row: d,
            kind: "clim",
        }));
    const hoverAnio = anioActual.points
        .filter((d) => d.v != null && Number.isFinite(d.v))
        .map((d) => ({
        cx: x(d.Month),
        cy: y(d.v),
        row: d,
        kind: "anio",
        color: anioColor,
    }));
    geniusBindNearestPointHover(svg, {
        panelId: container.id || "lst-explorer-monthly",
        innerWidth,
        innerHeight,
        tooltip,
        points: [...hoverClim, ...hoverAnio],
        html: (p) => {
            if (p.kind === "anio") {
                const rv = p.row.v;
                return (
                    `Año actual (${anioActual.year}): ` +
                    (rv != null && Number.isFinite(rv) ? rv.toFixed(2) : "—") +
                    ` °C<br>Mes: ${p.row.Month}`
                );
            }
            const r = p.row;
            let h =
                `LST (P50): ${r.LST_median.toFixed(2)} °C<br>Mes: ${r.Month}`;
            if (
                r.LST_p25 != null &&
                r.LST_p75 != null &&
                !Number.isNaN(r.LST_p25) &&
                !Number.isNaN(r.LST_p75)
            ) {
                h += `<br>P25: ${(+r.LST_p25).toFixed(2)} &nbsp; P75: ${(+r.LST_p75).toFixed(2)}`;
            }
            return h;
        },
    });
}

function ensureLstModal() {
    let el = document.getElementById("lst-zonal-explorer-root");
    if (el) {
        const dlg = el.querySelector(".ndvi-zonal-explorer-dialog");
        if (dlg && !dlg.id) dlg.id = "lst-zonal-explorer-dialog";
        return el;
    }
    el = document.createElement("div");
    el.id = "lst-zonal-explorer-root";
    el.className = "ndvi-zonal-explorer-root";
    el.innerHTML = `
<div class="ndvi-zonal-explorer-backdrop" aria-hidden="true">
  <div id="lst-zonal-explorer-dialog" class="ndvi-zonal-explorer-dialog" role="dialog" aria-modal="true" aria-labelledby="lst-zonal-explorer-title">
    <button type="button" class="ndvi-zonal-explorer-close" aria-label="Cerrar">&times;</button>
    <h2 id="lst-zonal-explorer-title" class="ndvi-zonal-explorer-title"></h2>
    <div class="ndvi-zonal-explorer-loading" hidden>Cargando…</div>
    <div id="lst-explorer-annual" class="chart-container ndvi-zonal-explorer-chart"></div>
    <div id="lst-explorer-monthly" class="chart-container ndvi-zonal-explorer-chart"></div>
  </div>
</div>`;
    document.body.appendChild(el);
    el.querySelector(".ndvi-zonal-explorer-backdrop").addEventListener("click", (ev) => {
        if (ev.target.classList.contains("ndvi-zonal-explorer-backdrop")) closeLstZonalExplorer();
    });
    el.querySelector(".ndvi-zonal-explorer-close").addEventListener("click", () => closeLstZonalExplorer());
    return el;
}

export function closeLstZonalExplorer() {
    const root = document.getElementById("lst-zonal-explorer-root");
    if (!root) return;
    root.classList.remove("ndvi-zonal-explorer-root--open");
    const bd = root.querySelector(".ndvi-zonal-explorer-backdrop");
    if (bd) bd.setAttribute("aria-hidden", "true");
}

export async function openLstZonalExplorer({ barrioNombre, labelTitle }) {
    const root = ensureLstModal();
    const titleEl = root.querySelector(".ndvi-zonal-explorer-title");
    const loadEl = root.querySelector(".ndvi-zonal-explorer-loading");
    const safeLabel = labelTitle || barrioNombre;
    titleEl.textContent = `LST — ${safeLabel}`;
    root.classList.add("ndvi-zonal-explorer-root--open");
    const bd = root.querySelector(".ndvi-zonal-explorer-backdrop");
    if (bd) bd.setAttribute("aria-hidden", "false");
    loadEl.hidden = false;

    const annualEl = document.getElementById("lst-explorer-annual");
    const monthlyEl = document.getElementById("lst-explorer-monthly");
    annualEl.innerHTML = "";
    monthlyEl.innerHTML = "";

    try {
        const { annual, monthlyRows } = await fetchLstZonalExplorerData(barrioNombre);
        loadEl.hidden = true;
        renderAnnualChart(annualEl, annual, `LST anual — ${safeLabel}`);
        await renderMonthlyChart(monthlyEl, monthlyRows, `LST mensual — ${safeLabel}`);
    } catch (e) {
        console.error("lst_zonal_explorer", e);
        loadEl.hidden = true;
        annualEl.textContent = "No se pudieron cargar los datos.";
    }
}

function onLstExploreClick(e) {
    const btn = e.target.closest("[data-lst-explore='barrio']");
    if (!btn) return;
    e.preventDefault();
    const enc = btn.getAttribute("data-barrio") || "";
    const nombre = decodeURIComponent(enc);
    openLstZonalExplorer({ barrioNombre: nombre, labelTitle: nombre });
}

/** Delegación en document (popups MapLibre están fuera del panel del mapa). */
export function installLstZonalExplorerHost() {
    if (lstExplorerHostInstalled) return;
    lstExplorerHostInstalled = true;
    document.body.addEventListener("click", onLstExploreClick);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeLstZonalExplorer();
    });
}

function lstVal(props) {
    const v = props.LST_mean;
    if (v == null || v === "") return "Sin datos";
    const n = Number(v);
    return Number.isFinite(n) ? esc(n.toFixed(1)) : "Sin datos";
}

export function lstBarrioPopupHtml(props) {
    const nombre = props.NOMBRE ?? "";
    const enc = encodeURIComponent(String(nombre));
    return `
<div class="popup-title">${esc(nombre)}</div>
<div class="popup-row"><span class="popup-label">Año</span><span class="popup-value">${esc(props.Year)}</span></div>
<div class="popup-row"><span class="popup-label">LST (°C)</span><span class="popup-value">${lstVal(props)}</span></div>
<div class="popup-actions"><button type="button" class="popup-explore-btn" data-lst-explore="barrio" data-barrio="${enc}">Explorar series</button></div>`;
}

export function lstManzanaPopupHtml(props) {
    const mz = props.MANZENT ?? "";
    return `
<div class="popup-title">Manzana ${esc(mz)}</div>
<div class="popup-row"><span class="popup-label">Personas</span><span class="popup-value">${esc(props.TOTAL_PERS)}</span></div>
<div class="popup-row"><span class="popup-label">Año</span><span class="popup-value">${esc(props.Year)}</span></div>
<div class="popup-row"><span class="popup-label">LST (°C)</span><span class="popup-value">${lstVal(props)}</span></div>`;
}

export function lstBarrioPopupHtmlMonthly(props) {
    const nombre = props.NOMBRE ?? "";
    const enc = encodeURIComponent(String(nombre));
    return `
<div class="popup-title">${esc(nombre)}</div>
<div class="popup-row"><span class="popup-label">Mes</span><span class="popup-value">${esc(props.Month)}</span></div>
<div class="popup-row"><span class="popup-label">LST (°C)</span><span class="popup-value">${lstVal(props)}</span></div>
<div class="popup-actions"><button type="button" class="popup-explore-btn" data-lst-explore="barrio" data-barrio="${enc}">Explorar series</button></div>`;
}

export function lstManzanaPopupHtmlMonthly(props) {
    const mz = props.MANZENT ?? "";
    return `
<div class="popup-title">Manzana ${esc(mz)}</div>
<div class="popup-row"><span class="popup-label">Personas</span><span class="popup-value">${esc(props.TOTAL_PERS)}</span></div>
<div class="popup-row"><span class="popup-label">Mes</span><span class="popup-value">${esc(props.Month)}</span></div>
<div class="popup-row"><span class="popup-label">LST (°C)</span><span class="popup-value">${lstVal(props)}</span></div>`;
}

export function lstBarrioPopupHtmlTrend(props) {
    const nombre = props.NOMBRE ?? "";
    const enc = encodeURIComponent(String(nombre));
    const slope =
        props.slope_median != null && !Number.isNaN(Number(props.slope_median))
            ? esc(Number(props.slope_median).toFixed(4))
            : "Sin datos";
    return `
<div class="popup-title">${esc(nombre)}</div>
<div class="popup-row"><span class="popup-label">Tendencia (°C/año)</span><span class="popup-value">${slope}</span></div>
<div class="popup-actions"><button type="button" class="popup-explore-btn" data-lst-explore="barrio" data-barrio="${enc}">Explorar series</button></div>`;
}

export function lstManzanaPopupHtmlTrend(props) {
    const mz = props.MANZENT ?? "";
    const slope =
        props.slope_median != null && !Number.isNaN(Number(props.slope_median))
            ? esc(Number(props.slope_median).toFixed(4))
            : "Sin datos";
    return `
<div class="popup-title">Manzana ${esc(mz)}</div>
<div class="popup-row"><span class="popup-label">Tendencia (°C/año)</span><span class="popup-value">${slope}</span></div>`;
}
