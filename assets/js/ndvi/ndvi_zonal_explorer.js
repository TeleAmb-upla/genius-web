/**
 * Exploración NDVI por barrio: mismos tipos de gráfico que el área urbana
 * (NDVI anual + NDVI mensual), desde GeoJSON zonales de barrios y CSV asociados.
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
} from "../chart_monthly_pctl_band.js";
import {
    geniusAppendAnioActualLine,
    geniusAppendMonthlyClimatologyLegend,
    geniusExpandDomainWithPoints,
    geniusResolveAnioActualSeries,
    geniusWallNdviAnioActualFromCsv,
    GENIUS_ANIO_ACTUAL_CSV_KEY,
} from "../chart_monthly_estado_actual.js";
import { geniusParseMonthlyMetric } from "../chart_monthly_pctl_band.js";
import {
    geniusAnnualPctlYExtent,
    geniusAppendAnnualPctlBand,
    geniusAppendAnnualSeriesLegend,
    geniusFilterNdviYearMonthValue,
    geniusParseAnnualMetricOrNull,
} from "../chart_annual_pctl_band.js";
import { geniusMonthlyAnioColor } from "../chart_variable_accent.js";
import { geniusBindNearestPointHover } from "../chart_tooltip_genius.js";

const YEARLY_BARIOS =
    "assets/data/geojson/NDVI/NDVI_Yearly_ZonalStats/NDVI_Yearly_ZonalStats_Barrios/NDVI_Yearly_ZonalStats_Barrios";
const MONTHLY_BARIOS =
    "assets/data/geojson/NDVI/NDVI_Monthly_ZonalStats/NDVI_Monthly_ZonalStats_Barrios/NDVI_Monthly_ZonalStats_Barrios";

/** JSON generado por ``scripts/repo/bundles/build_ndvi_zonal_explorer_bundle.py`` (anual + mensual por barrio). */
const NDVI_ZONAL_EXPLORER_BAR = "assets/data/csv/NDVI_zonal_explorer_barrios.json";

/** Fallback GEE: climatología con P25/P75 si existen en repo. */
const NDVI_M_ZONAL_BAR = "assets/data/csv/NDVI_m_zonal_barrios.csv";

/** Anual zonal (P50 + P25/P75 intra-anuales), misma lógica que ``NDVI_y_urban``. */
const NDVI_Y_ZONAL_BAR = "assets/data/csv/NDVI_y_zonal_barrios.csv";

let hostInstalled = false;
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
 * @returns {Promise<Array<{ Year: number, NDVI_median: number }>>}
 */
export async function fetchNdviZonalAnnualSeries(barrioNombre) {
    const years = getProductYears("ndvi_zonal");
    const base = YEARLY_BARIOS;
    const payloads = await Promise.all(
        years.map(async (y) => {
            const url = resolveAssetUrl(`${base}_${y}.geojson`);
            const gj = await fetchJson(url);
            if (!gj?.features?.length) return null;
            const feat = gj.features.find((f) => matchBarrio(f, barrioNombre));
            if (!feat?.properties) return null;
            const v = feat.properties.NDVI;
            if (v == null || v === "") return null;
            const num = +v;
            if (!Number.isFinite(num)) return null;
            return {
                Year: +y,
                NDVI_median: num,
                NDVI_p25: null,
                NDVI_p75: null,
            };
        }),
    );
    return payloads.filter(Boolean).sort((a, b) => a.Year - b.Year);
}

/**
 * Mediana climatológica por mes desde GeoJSON (12 capas); sin percentiles ni año–mes.
 * @returns {Promise<Array<Record<string,string>>>}
 */
async function fetchNdviZonalMonthlyRowsGeojson(barrioNombre) {
    const base = MONTHLY_BARIOS;
    const rows = [];
    for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, "0");
        const url = resolveAssetUrl(`${base}_${mm}.geojson`);
        const gj = await fetchJson(url);
        let ndvi = null;
        if (gj?.features?.length) {
            const feat = gj.features.find((f) => matchBarrio(f, barrioNombre));
            if (feat?.properties && feat.properties.NDVI != null && feat.properties.NDVI !== "") {
                const num = +feat.properties.NDVI;
                if (Number.isFinite(num)) ndvi = num;
            }
        }
        rows.push({
            Month: String(m),
            NDVI: ndvi != null ? String(ndvi) : "",
            NDVI_p25: "",
            NDVI_p75: "",
        });
    }
    return rows;
}

async function loadNdviMZonalCsv() {
    if (_mZonalBarCache !== undefined) return _mZonalBarCache;
    const url =
        typeof resolveAssetUrl === "function"
            ? resolveAssetUrl(NDVI_M_ZONAL_BAR)
            : NDVI_M_ZONAL_BAR;
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
 * Une CSV mensual GEE (``NDVI_m_zonal_*``) con fallback GeoJSON por mes.
 * @returns {Array<Record<string,string>>}
 */
async function loadNdviYZonalCsv() {
    if (_yZonalBarCache !== undefined) return _yZonalBarCache;
    const url =
        typeof resolveAssetUrl === "function"
            ? resolveAssetUrl(NDVI_Y_ZONAL_BAR)
            : NDVI_Y_ZONAL_BAR;
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
 * @param {Array<{ Year: number, NDVI_median: number, NDVI_p25: number | null, NDVI_p75: number | null }>} annualPoints
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
        let mid = p.NDVI_median;
        if (c.NDVI != null && String(c.NDVI).trim() !== "") {
            const v = geniusFilterNdviYearMonthValue(+c.NDVI);
            if (v != null) mid = v;
        }
        let p25 = p.NDVI_p25;
        let p75 = p.NDVI_p75;
        if (c.NDVI_p25 != null && String(c.NDVI_p25).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(c.NDVI_p25).trim());
            p25 = parsed != null ? geniusFilterNdviYearMonthValue(parsed) : null;
        }
        if (c.NDVI_p75 != null && String(c.NDVI_p75).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(c.NDVI_p75).trim());
            p75 = parsed != null ? geniusFilterNdviYearMonthValue(parsed) : null;
        }
        return { Year: p.Year, NDVI_median: mid, NDVI_p25: p25, NDVI_p75: p75 };
    });
    const seen = new Set(out.map((p) => p.Year));
    for (const r of entityCsvRows) {
        const y = Math.round(+r.Year);
        if (!Number.isFinite(y) || seen.has(y)) continue;
        let mid = null;
        if (r.NDVI != null && String(r.NDVI).trim() !== "") {
            mid = geniusFilterNdviYearMonthValue(+r.NDVI);
        }
        if (mid == null) continue;
        let p25 = null;
        let p75 = null;
        if (r.NDVI_p25 != null && String(r.NDVI_p25).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(r.NDVI_p25).trim());
            p25 = parsed != null ? geniusFilterNdviYearMonthValue(parsed) : null;
        }
        if (r.NDVI_p75 != null && String(r.NDVI_p75).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(r.NDVI_p75).trim());
            p75 = parsed != null ? geniusFilterNdviYearMonthValue(parsed) : null;
        }
        out.push({ Year: y, NDVI_median: mid, NDVI_p25: p25, NDVI_p75: p75 });
        seen.add(y);
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
                NDVI: csv.NDVI != null ? String(csv.NDVI).trim() : "",
                NDVI_p25: csv.NDVI_p25 != null ? String(csv.NDVI_p25).trim() : "",
                NDVI_p75: csv.NDVI_p75 != null ? String(csv.NDVI_p75).trim() : "",
                anio_actual:
                    csv.anio_actual != null ? String(csv.anio_actual).trim() : "",
            });
        } else {
            out.push({
                Month: String(m),
                NDVI:
                    geo?.NDVI != null && String(geo.NDVI).trim() !== ""
                        ? String(geo.NDVI)
                        : "",
                NDVI_p25: "",
                NDVI_p75: "",
                anio_actual: "",
            });
        }
    }
    return out;
}

/**
 * Climatología mensual: prioriza ``NDVI_m_zonal_barrios`` (GEE) si existe.
 * @returns {Promise<{ rows: Array<Record<string,string>> }>}
 */
export async function fetchNdviZonalMonthlyCharts(barrioNombre) {
    const geoRows = await fetchNdviZonalMonthlyRowsGeojson(barrioNombre);
    const all = await loadNdviMZonalCsv();
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
            ? resolveAssetUrl(NDVI_ZONAL_EXPLORER_BAR)
            : NDVI_ZONAL_EXPLORER_BAR;
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
            let mid = +r.NDVI;
            if (!Number.isFinite(mid)) mid = NaN;
            mid = geniusFilterNdviYearMonthValue(mid);
            let p25 =
                r.NDVI_p25 != null && String(r.NDVI_p25).trim() !== ""
                    ? geniusParseAnnualMetricOrNull(String(r.NDVI_p25))
                    : null;
            let p75 =
                r.NDVI_p75 != null && String(r.NDVI_p75).trim() !== ""
                    ? geniusParseAnnualMetricOrNull(String(r.NDVI_p75))
                    : null;
            p25 = geniusFilterNdviYearMonthValue(p25);
            p75 = geniusFilterNdviYearMonthValue(p75);
            return { Year: y, NDVI_median: mid, NDVI_p25: p25, NDVI_p75: p75 };
        })
        .filter(
            (r) =>
                Number.isFinite(r.Year) &&
                r.NDVI_median != null &&
                Number.isFinite(r.NDVI_median),
        );
}

function monthlyBundleToRawRows(monthly) {
    if (!Array.isArray(monthly)) return [];
    return monthly.map((r) => ({
        Month: String(r.Month),
        NDVI: r.NDVI != null ? String(r.NDVI) : "",
        NDVI_p25: r.NDVI_p25 != null ? String(r.NDVI_p25) : "",
        NDVI_p75: r.NDVI_p75 != null ? String(r.NDVI_p75) : "",
        anio_actual: r.anio_actual != null ? String(r.anio_actual) : "",
    }));
}

/**
 * Serie anual + filas mensuales: un único JSON por tipo si existe; si no, GeoJSON/CSV sueltos.
 * Siempre intenta fusionar ``NDVI_y_zonal_*`` (fetch) para bandas P25–P75 anuales aunque el bundle
 * se haya generado antes de existir ese CSV.
 *
 * @returns {Promise<{ annual: Array<{Year:number,NDVI_median:number}>, monthlyRows: Array<Record<string,string>> }>}
 */
export async function fetchNdviZonalExplorerData(barrioNombre) {
    const [bundle, yCsvAll] = await Promise.all([
        loadZonalExplorerBundle(),
        loadNdviYZonalCsv(),
    ]);
    const zonalYears = new Set(getProductYears("ndvi_zonal"));
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
            fetchNdviZonalAnnualSeries(barrioNombre),
            fetchNdviZonalMonthlyCharts(barrioNombre),
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
        .text("NDVI");

    const [minNDVI, maxNDVI] = geniusAnnualPctlYExtent(
        data,
        "NDVI_median",
        "NDVI_p25",
        "NDVI_p75",
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
        lineColor: "steelblue",
        bandFillColor: "steelblue",
        medianLabel: "Mediana anual",
    });

    geniusAppendAnnualPctlBand(svg, {
        data,
        xBand: x,
        yearKey: "Year",
        y,
        p25Key: "NDVI_p25",
        p75Key: "NDVI_p75",
        fill: "steelblue",
    });

    const line = d3
        .line()
        .x((d) => x(d.Year) + x.bandwidth() / 2)
        .y((d) => y(d.NDVI_median))
        .curve(d3.curveCatmullRom.alpha(0.5));

    const path = svg
        .append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", "steelblue")
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
        .data(data)
        .enter()
        .append("circle")
        .attr("cx", (d) => x(d.Year) + x.bandwidth() / 2)
        .attr("cy", (d) => y(d.NDVI_median))
        .attr("r", 4)
        .attr("fill", "steelblue")
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
        panelId: container.id || "ndvi-explorer-annual",
        innerWidth,
        innerHeight,
        tooltip,
        points: data.map((d) => ({
            cx: x(d.Year) + x.bandwidth() / 2,
            cy: y(d.NDVI_median),
            row: d,
            kind: "y",
        })),
        html: (p) => {
            const r = p.row;
            let s = `Año: ${r.Year}<br>NDVI: ${r.NDVI_median.toFixed(3)}`;
            if (
                r.NDVI_p25 != null &&
                r.NDVI_p75 != null &&
                Number.isFinite(+r.NDVI_p25) &&
                Number.isFinite(+r.NDVI_p75)
            ) {
                s += `<br>P25–P75: ${(+r.NDVI_p25).toFixed(3)} – ${(+r.NDVI_p75).toFixed(
                    3,
                )}`;
            }
            return s;
        },
    });
}

function renderMonthlyChart(container, rawRows, titleText) {
    d3.select(container).selectAll("*").remove();
    const data = rawRows.map((d) => ({ ...d }));
    data.forEach((d) => {
        d.Month = +d.Month;
        const vm = geniusParseMonthlyMetric(d.NDVI);
        d.NDVI_median = vm != null ? vm : NaN;
        if (d.NDVI_p25 != null && String(d.NDVI_p25).trim() !== "")
            d.NDVI_p25 = geniusParseMonthlyMetric(String(d.NDVI_p25));
        else d.NDVI_p25 = null;
        if (d.NDVI_p75 != null && String(d.NDVI_p75).trim() !== "")
            d.NDVI_p75 = geniusParseMonthlyMetric(String(d.NDVI_p75));
        else d.NDVI_p75 = null;
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
        .text("NDVI");

    const wall = geniusWallNdviAnioActualFromCsv();
    const [minNDVI0, maxNDVI0] = geniusMonthlyPctlExtentMulti(data, [
        { mid: "NDVI_median", p25: "NDVI_p25", p75: "NDVI_p75" },
    ]);
    const anioActual = geniusResolveAnioActualSeries({
        monthlyData: data,
        anioKey: GENIUS_ANIO_ACTUAL_CSV_KEY,
        ymRows: null,
        ymKeys: null,
        wall,
    });
    const anioColor = geniusMonthlyAnioColor("ndvi");
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
        climColor: "steelblue",
        bandFillColor: "steelblue",
        anioColor: anioActual.points.length ? anioColor : null,
        anioYear: anioActual.points.length ? anioActual.year : null,
    });

    geniusAppendMonthlyPctlBand(svg, {
        data,
        x: (d) => x(d.Month),
        y,
        p25Key: "NDVI_p25",
        p75Key: "NDVI_p75",
        fill: "steelblue",
        fillOpacity: 0.22,
    });

    const line = d3
        .line()
        .defined((d) => Number.isFinite(d.NDVI_median))
        .x((d) => x(d.Month))
        .y((d) => y(d.NDVI_median))
        .curve(d3.curveCatmullRom.alpha(0.5));

    const path = svg.append("path").datum(data.filter((d) => Number.isFinite(d.NDVI_median))).attr("fill", "none").attr("stroke", "steelblue").attr("stroke-width", 1.5).attr("d", line);
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
        .data(data.filter((d) => Number.isFinite(d.NDVI_median)))
        .enter()
        .append("circle")
        .attr("cx", (d) => x(d.Month))
        .attr("cy", (d) => y(d.NDVI_median))
        .attr("r", 4)
        .attr("fill", "steelblue")
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
        .filter((d) => Number.isFinite(d.NDVI_median))
        .map((d) => ({
            cx: x(d.Month),
            cy: y(d.NDVI_median),
            row: d,
            kind: "clim",
        }));
    const hoverAnio = anioActual.points.map((d) => ({
        cx: x(d.Month),
        cy: y(d.v),
        row: d,
        kind: "anio",
        color: anioColor,
    }));
    geniusBindNearestPointHover(svg, {
        panelId: container.id || "ndvi-explorer-monthly",
        innerWidth,
        innerHeight,
        tooltip,
        points: [...hoverClim, ...hoverAnio],
        html: (p) => {
            if (p.kind === "anio") {
                return (
                    `Año actual (${anioActual.year}): ${p.row.v.toFixed(3)}<br>Mes: ${p.row.Month}`
                );
            }
            const r = p.row;
            let h =
                `NDVI (P50): ${r.NDVI_median.toFixed(3)}<br>Mes: ${r.Month}`;
            if (
                r.NDVI_p25 != null &&
                r.NDVI_p75 != null &&
                !Number.isNaN(r.NDVI_p25) &&
                !Number.isNaN(r.NDVI_p75)
            ) {
                h += `<br>P25: ${(+r.NDVI_p25).toFixed(3)} &nbsp; P75: ${(+r.NDVI_p75).toFixed(3)}`;
            }
            return h;
        },
    });
}

function ensureModal() {
    let el = document.getElementById("ndvi-zonal-explorer-root");
    if (el) {
        const dlg = el.querySelector(".ndvi-zonal-explorer-dialog");
        if (dlg && !dlg.id) dlg.id = "ndvi-zonal-explorer-dialog";
        return el;
    }
    el = document.createElement("div");
    el.id = "ndvi-zonal-explorer-root";
    el.className = "ndvi-zonal-explorer-root";
    el.innerHTML = `
<div class="ndvi-zonal-explorer-backdrop" aria-hidden="true">
  <div id="ndvi-zonal-explorer-dialog" class="ndvi-zonal-explorer-dialog" role="dialog" aria-modal="true" aria-labelledby="ndvi-zonal-explorer-title">
    <button type="button" class="ndvi-zonal-explorer-close" aria-label="Cerrar">&times;</button>
    <h2 id="ndvi-zonal-explorer-title" class="ndvi-zonal-explorer-title"></h2>
    <div class="ndvi-zonal-explorer-loading" hidden>Cargando…</div>
    <div id="ndvi-explorer-annual" class="chart-container ndvi-zonal-explorer-chart"></div>
    <div id="ndvi-explorer-monthly" class="chart-container ndvi-zonal-explorer-chart"></div>
  </div>
</div>`;
    document.body.appendChild(el);
    el.querySelector(".ndvi-zonal-explorer-backdrop").addEventListener("click", (ev) => {
        if (ev.target.classList.contains("ndvi-zonal-explorer-backdrop")) closeNdviZonalExplorer();
    });
    el.querySelector(".ndvi-zonal-explorer-close").addEventListener("click", () => closeNdviZonalExplorer());
    return el;
}

export function closeNdviZonalExplorer() {
    const root = document.getElementById("ndvi-zonal-explorer-root");
    if (!root) return;
    root.classList.remove("ndvi-zonal-explorer-root--open");
    const bd = root.querySelector(".ndvi-zonal-explorer-backdrop");
    if (bd) bd.setAttribute("aria-hidden", "true");
}

export async function openNdviZonalExplorer({ barrioNombre, labelTitle }) {
    const root = ensureModal();
    const titleEl = root.querySelector(".ndvi-zonal-explorer-title");
    const loadEl = root.querySelector(".ndvi-zonal-explorer-loading");
    const safeLabel = labelTitle || barrioNombre;
    titleEl.textContent = `NDVI — ${safeLabel}`;
    root.classList.add("ndvi-zonal-explorer-root--open");
    const bd = root.querySelector(".ndvi-zonal-explorer-backdrop");
    if (bd) bd.setAttribute("aria-hidden", "false");
    loadEl.hidden = false;

    const annualEl = document.getElementById("ndvi-explorer-annual");
    const monthlyEl = document.getElementById("ndvi-explorer-monthly");
    annualEl.innerHTML = "";
    monthlyEl.innerHTML = "";

    try {
        const { annual, monthlyRows } = await fetchNdviZonalExplorerData(barrioNombre);
        loadEl.hidden = true;
        renderAnnualChart(
            annualEl,
            annual,
            `NDVI anual — ${safeLabel}`,
        );
        renderMonthlyChart(monthlyEl, monthlyRows, `NDVI mensual — ${safeLabel}`);
    } catch (e) {
        console.error("ndvi_zonal_explorer", e);
        loadEl.hidden = true;
        annualEl.textContent = "No se pudieron cargar los datos.";
    }
}

function onExploreClick(e) {
    const btn = e.target.closest("[data-ndvi-explore='barrio']");
    if (!btn) return;
    e.preventDefault();
    const enc = btn.getAttribute("data-barrio") || "";
    const nombre = decodeURIComponent(enc);
    openNdviZonalExplorer({ barrioNombre: nombre, labelTitle: nombre });
}

/** Delegación en document (popups MapLibre están fuera del panel del mapa). */
export function installNdviZonalExplorerHost() {
    if (hostInstalled) return;
    hostInstalled = true;
    document.body.addEventListener("click", onExploreClick);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeNdviZonalExplorer();
    });
}

export function ndviBarrioPopupHtml(props) {
    const nombre = props.NOMBRE ?? "";
    const enc = encodeURIComponent(String(nombre));
    return `
<div class="popup-title">${esc(nombre)}</div>
<div class="popup-row"><span class="popup-label">Año</span><span class="popup-value">${esc(props.Year)}</span></div>
<div class="popup-row"><span class="popup-label">NDVI</span><span class="popup-value">${props.NDVI != null ? esc(Number(props.NDVI).toFixed(3)) : "Sin datos"}</span></div>
<div class="popup-actions"><button type="button" class="popup-explore-btn" data-ndvi-explore="barrio" data-barrio="${enc}">Explorar series</button></div>`;
}

export function ndviManzanaPopupHtml(props) {
    const mz = props.MANZENT ?? "";
    return `
<div class="popup-title">Manzana ${esc(mz)}</div>
<div class="popup-row"><span class="popup-label">Personas</span><span class="popup-value">${esc(props.TOTAL_PERS)}</span></div>
<div class="popup-row"><span class="popup-label">Año</span><span class="popup-value">${esc(props.Year)}</span></div>
<div class="popup-row"><span class="popup-label">NDVI</span><span class="popup-value">${props.NDVI != null ? esc(Number(props.NDVI).toFixed(3)) : "Sin datos"}</span></div>`;
}

export function ndviBarrioPopupHtmlMonthly(props) {
    const nombre = props.NOMBRE ?? "";
    const enc = encodeURIComponent(String(nombre));
    return `
<div class="popup-title">${esc(nombre)}</div>
<div class="popup-row"><span class="popup-label">Mes</span><span class="popup-value">${esc(props.Month)}</span></div>
<div class="popup-row"><span class="popup-label">NDVI</span><span class="popup-value">${props.NDVI != null ? esc(Number(props.NDVI).toFixed(3)) : "Sin datos"}</span></div>
<div class="popup-actions"><button type="button" class="popup-explore-btn" data-ndvi-explore="barrio" data-barrio="${enc}">Explorar series</button></div>`;
}

export function ndviManzanaPopupHtmlMonthly(props) {
    const mz = props.MANZENT ?? "";
    return `
<div class="popup-title">Manzana ${esc(mz)}</div>
<div class="popup-row"><span class="popup-label">Personas</span><span class="popup-value">${esc(props.TOTAL_PERS)}</span></div>
<div class="popup-row"><span class="popup-label">Mes</span><span class="popup-value">${esc(props.Month)}</span></div>
<div class="popup-row"><span class="popup-label">NDVI</span><span class="popup-value">${props.NDVI != null ? esc(Number(props.NDVI).toFixed(3)) : "Sin datos"}</span></div>`;
}

export function ndviBarrioPopupHtmlTrend(props) {
    const nombre = props.NOMBRE ?? "";
    const enc = encodeURIComponent(String(nombre));
    const slope =
        props.slope_median != null && !Number.isNaN(Number(props.slope_median))
            ? esc(Number(props.slope_median).toFixed(4))
            : "Sin datos";
    return `
<div class="popup-title">${esc(nombre)}</div>
<div class="popup-row"><span class="popup-label">Tendencia (pendiente)</span><span class="popup-value">${slope}</span></div>
<div class="popup-actions"><button type="button" class="popup-explore-btn" data-ndvi-explore="barrio" data-barrio="${enc}">Explorar series</button></div>`;
}

export function ndviManzanaPopupHtmlTrend(props) {
    const mz = props.MANZENT ?? "";
    const slope =
        props.slope_median != null && !Number.isNaN(Number(props.slope_median))
            ? esc(Number(props.slope_median).toFixed(4))
            : "Sin datos";
    return `
<div class="popup-title">Manzana ${esc(mz)}</div>
<div class="popup-row"><span class="popup-label">Tendencia (pendiente)</span><span class="popup-value">${slope}</span></div>`;
}
