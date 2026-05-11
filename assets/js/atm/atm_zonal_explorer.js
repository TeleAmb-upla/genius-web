/**
 * Exploración por barrio — AOD, NO₂, SO₂ (series anual + mensual como NDVI/LST).
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
    geniusFillMissingMonthlyPctlInterannualFromYearMonth,
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
    geniusFillMissingAnnualPctlFromYearMonth,
    geniusFilterAodYearMonthValue,
    geniusParseAnnualMetricOrNull,
} from "../chart_annual_pctl_band.js";
import { geniusMonthlyAnioColor } from "../chart_variable_accent.js";
import { geniusBindNearestPointHover } from "../chart_tooltip_genius.js";
import { so2UmolForDisplay } from "./so2/so2_units.js";

const ATM_CLIM_STEEL = "steelblue";

/** Unifica escala ATM en gráficos (SO₂ µmol; AOD CSV heterogéneo). */
function convAfterParse(cfg, v) {
    if (!Number.isFinite(v)) return v;
    if (cfg.accentKey === "so2") {
        const u = so2UmolForDisplay(v);
        return u != null ? u : NaN;
    }
    if (cfg.accentKey === "aod") {
        const u = geniusFilterAodYearMonthValue(v);
        return u != null ? u : NaN;
    }
    return v;
}

/** @typedef {'aod' | 'no2' | 'so2'} AtmExplorerVar */

/** @type {Record<AtmExplorerVar, Record<string, string>>} */
const ATM_CFG = {
    aod: {
        productYearsKey: "aod",
        bundleUrl: "assets/data/csv/AOD_zonal_explorer_barrios.json",
        csvM: "assets/data/csv/AOD_m_zonal_barrios.csv",
        csvY: "assets/data/csv/AOD_y_zonal_barrios.csv",
        yearlyGeoBase:
            "assets/data/geojson/AOD/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Barrios/AOD_Yearly_ZonalStats_Barrios",
        monthlyGeoBase:
            "assets/data/geojson/AOD/AOD_Monthly_ZonalStats/AOD_Monthly_ZonalStats_Barrios/AOD_Monthly_ZonalStats_Barrios",
        geoYearProp: "AOD_median",
        geoMonthProp: "AOD_median",
        medianCol: "AOD_median",
        p25Col: "AOD_p25",
        p75Col: "AOD_p75",
        ymCsvKey: "aodUrban",
        ymValueKey: "AOD_median",
        accentKey: "aod",
        axisY: "AOD",
        modalTitle: "AOD",
        popupLabel: "AOD",
        decimalsPopup: "3",
    },
    no2: {
        productYearsKey: "no2",
        bundleUrl: "assets/data/csv/NO2_zonal_explorer_barrios.json",
        csvM: "assets/data/csv/NO2_m_zonal_barrios.csv",
        csvY: "assets/data/csv/NO2_y_zonal_barrios.csv",
        yearlyGeoBase:
            "assets/data/geojson/NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Barrios/NO2_Yearly_ZonalStats_Barrios",
        monthlyGeoBase:
            "assets/data/geojson/NO2/NO2_Monthly_ZonalStats/NO2_Monthly_ZonalStats_Barrios/NO2_Monthly_ZonalStats_Barrios",
        geoYearProp: "NO2_median",
        geoMonthProp: "NO2_median",
        medianCol: "NO2_median",
        p25Col: "NO2_p25",
        p75Col: "NO2_p75",
        ymCsvKey: "no2Urban",
        ymValueKey: "NO2_median",
        accentKey: "no2",
        axisY: "NO₂",
        modalTitle: "NO₂",
        popupLabel: "NO₂ (µg/m³)",
        decimalsPopup: "2",
    },
    so2: {
        productYearsKey: "so2",
        bundleUrl: "assets/data/csv/SO2_zonal_explorer_barrios.json",
        csvM: "assets/data/csv/SO2_m_zonal_barrios.csv",
        csvY: "assets/data/csv/SO2_y_zonal_barrios.csv",
        yearlyGeoBase:
            "assets/data/geojson/SO2/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Barrios/SO2_Yearly_ZonalStats_Barrios",
        monthlyGeoBase:
            "assets/data/geojson/SO2/SO2_Monthly_ZonalStats/SO2_Monthly_ZonalStats_Barrios/SO2_Monthly_ZonalStats_Barrios",
        geoYearProp: "SO2",
        geoMonthProp: "SO2",
        medianCol: "SO2",
        p25Col: "SO2_p25",
        p75Col: "SO2_p75",
        ymCsvKey: "so2Urban",
        ymValueKey: "SO2",
        accentKey: "so2",
        axisY: "SO₂",
        modalTitle: "SO₂",
        popupLabel: "SO₂ (µmol/m²)",
        decimalsPopup: "2",
    },
};

let atmExplorerHostInstalled = false;

/** @type {Partial<Record<AtmExplorerVar, unknown>>} */
const _bundleCache = {};

/** @type {Partial<Record<AtmExplorerVar, unknown>>} */
const _mCsvCache = {};

/** @type {Partial<Record<AtmExplorerVar, unknown>>} */
const _yCsvCache = {};

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

function fmtTooltip(varKey, v) {
    const cfg = ATM_CFG[varKey];
    const d = cfg.decimalsPopup === "3" ? 3 : 2;
    if (!Number.isFinite(v)) return "—";
    return v.toFixed(d);
}

function fmtPopupPrimary(varKey, props) {
    const cfg = ATM_CFG[varKey];
    const raw = props[cfg.geoYearProp];
    if (raw == null || raw === "") return "Sin datos";
    const n = Number(raw);
    if (!Number.isFinite(n)) return "Sin datos";
    let disp = cfg.accentKey === "so2" ? so2UmolForDisplay(n) : n;
    if (disp == null || !Number.isFinite(disp)) return "Sin datos";
    const d = cfg.decimalsPopup === "3" ? 3 : 2;
    return esc(disp.toFixed(d));
}

function fmtPopupPrimaryMonthly(varKey, props) {
    const cfg = ATM_CFG[varKey];
    const raw = props[cfg.geoMonthProp];
    if (raw == null || raw === "") return "Sin datos";
    const n = Number(raw);
    if (!Number.isFinite(n)) return "Sin datos";
    let disp = cfg.accentKey === "so2" ? so2UmolForDisplay(n) : n;
    if (disp == null || !Number.isFinite(disp)) return "Sin datos";
    const d = cfg.decimalsPopup === "3" ? 3 : 2;
    return esc(disp.toFixed(d));
}

/**
 * @param {Record<string, string>} cfg
 * @param {Record<string, string>} entityCsvRows
 * @param {Array<Record<string, unknown>>} annualPoints
 */
function mergeZonalAnnualFromEngineCsv(annualPoints, entityCsvRows, cfg) {
    const MK = cfg.medianCol;
    const P25 = cfg.p25Col;
    const P75 = cfg.p75Col;
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
        let mid = p[MK];
        if (c[MK] != null && String(c[MK]).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(c[MK]).trim());
            if (parsed != null) mid = convAfterParse(cfg, parsed);
        }
        let p25 = p[P25];
        let p75 = p[P75];
        if (c[P25] != null && String(c[P25]).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(c[P25]).trim());
            p25 = parsed != null ? convAfterParse(cfg, parsed) : null;
        }
        if (c[P75] != null && String(c[P75]).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(c[P75]).trim());
            p75 = parsed != null ? convAfterParse(cfg, parsed) : null;
        }
        return { Year: p.Year, [MK]: mid, [P25]: p25, [P75]: p75 };
    });
    const seen = new Set(out.map((p) => p.Year));
    for (const r of entityCsvRows) {
        const y = Math.round(+r.Year);
        if (!Number.isFinite(y) || seen.has(y)) continue;
        let mid = null;
        if (r[MK] != null && String(r[MK]).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(r[MK]).trim());
            mid = parsed != null ? convAfterParse(cfg, parsed) : null;
        }
        if (mid == null || !Number.isFinite(mid)) continue;
        let p25 = null;
        let p75 = null;
        if (r[P25] != null && String(r[P25]).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(r[P25]).trim());
            p25 = parsed != null ? convAfterParse(cfg, parsed) : null;
        }
        if (r[P75] != null && String(r[P75]).trim() !== "") {
            const parsed = geniusParseAnnualMetricOrNull(String(r[P75]).trim());
            p75 = parsed != null ? convAfterParse(cfg, parsed) : null;
        }
        out.push({ Year: y, [MK]: mid, [P25]: p25, [P75]: p75 });
        seen.add(y);
    }
    out.sort((a, b) => a.Year - b.Year);
    return out;
}

/**
 * @param {Record<string, string>} cfg
 * @param {Array<Record<string, string>>} entityRows
 * @param {Array<Record<string, string>>} geoRows
 */
function mergeZonalMonthlyFromEngineCsv(entityRows, geoRows, cfg) {
    const MK = cfg.medianCol;
    const P25 = cfg.p25Col;
    const P75 = cfg.p75Col;
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
                [MK]: csv[MK] != null ? String(csv[MK]).trim() : "",
                [P25]: csv[P25] != null ? String(csv[P25]).trim() : "",
                [P75]: csv[P75] != null ? String(csv[P75]).trim() : "",
                anio_actual:
                    csv.anio_actual != null ? String(csv.anio_actual).trim() : "",
            });
        } else {
            const gmk = geo?.[MK];
            out.push({
                Month: String(m),
                [MK]:
                    gmk != null && String(gmk).trim() !== ""
                        ? String(gmk)
                        : "",
                [P25]: "",
                [P75]: "",
                anio_actual: "",
            });
        }
    }
    return out;
}

async function loadAtmMZonalCsv(varKey) {
    const cfg = ATM_CFG[varKey];
    if (_mCsvCache[varKey] !== undefined) return _mCsvCache[varKey];
    const url =
        typeof resolveAssetUrl === "function"
            ? resolveAssetUrl(cfg.csvM)
            : cfg.csvM;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            _mCsvCache[varKey] = [];
            return [];
        }
        const text = await res.text();
        _mCsvCache[varKey] = d3.csvParse(text);
        return _mCsvCache[varKey];
    } catch {
        _mCsvCache[varKey] = [];
        return [];
    }
}

async function loadAtmYZonalCsv(varKey) {
    const cfg = ATM_CFG[varKey];
    if (_yCsvCache[varKey] !== undefined) return _yCsvCache[varKey];
    const url =
        typeof resolveAssetUrl === "function"
            ? resolveAssetUrl(cfg.csvY)
            : cfg.csvY;
    try {
        const res = await fetch(url);
        if (!res.ok) {
            _yCsvCache[varKey] = [];
            return [];
        }
        const text = await res.text();
        _yCsvCache[varKey] = d3.csvParse(text);
        return _yCsvCache[varKey];
    } catch {
        _yCsvCache[varKey] = [];
        return [];
    }
}

function filterZonalMonthlyForEntity(allRows, nombreBarrio) {
    const idt = String(nombreBarrio ?? "").trim();
    return allRows.filter((r) => String(r.NOMBRE ?? "").trim() === idt);
}

async function loadZonalExplorerBundle(varKey) {
    const cfg = ATM_CFG[varKey];
    if (_bundleCache[varKey] !== undefined) return _bundleCache[varKey];
    const url =
        typeof resolveAssetUrl === "function"
            ? resolveAssetUrl(cfg.bundleUrl)
            : cfg.bundleUrl;
    try {
        const r = await fetch(url);
        if (!r.ok) {
            _bundleCache[varKey] = null;
            return null;
        }
        const j = await r.json();
        const b = j?.entities ? j : null;
        _bundleCache[varKey] = b;
        return b;
    } catch {
        _bundleCache[varKey] = null;
        return null;
    }
}

function getZonalBundleEntity(bundle, id) {
    if (!bundle?.entities) return null;
    const k = String(id ?? "").trim();
    return bundle.entities[k] ?? null;
}

function annualBundleToChart(annual, cfg) {
    const MK = cfg.medianCol;
    const P25 = cfg.p25Col;
    const P75 = cfg.p75Col;
    if (!Array.isArray(annual)) return [];
    return annual
        .map((r) => {
            const y = +r.Year;
            let mid = geniusParseAnnualMetricOrNull(String(r[MK] ?? "").trim());
            if (mid != null && Number.isFinite(mid)) mid = convAfterParse(cfg, mid);
            else mid = NaN;
            let p25 =
                r[P25] != null && String(r[P25]).trim() !== ""
                    ? geniusParseAnnualMetricOrNull(String(r[P25]).trim())
                    : null;
            if (p25 != null && Number.isFinite(p25)) p25 = convAfterParse(cfg, p25);
            let p75 =
                r[P75] != null && String(r[P75]).trim() !== ""
                    ? geniusParseAnnualMetricOrNull(String(r[P75]).trim())
                    : null;
            if (p75 != null && Number.isFinite(p75)) p75 = convAfterParse(cfg, p75);
            return { Year: y, [MK]: mid, [P25]: p25, [P75]: p75 };
        })
        .filter((row) => Number.isFinite(row.Year));
}

function monthlyBundleToRawRows(monthly, cfg) {
    const MK = cfg.medianCol;
    const P25 = cfg.p25Col;
    const P75 = cfg.p75Col;
    if (!Array.isArray(monthly)) return [];
    return monthly.map((r) => ({
        Month: String(r.Month),
        [MK]: r[MK] != null ? String(r[MK]) : "",
        [P25]: r[P25] != null ? String(r[P25]) : "",
        [P75]: r[P75] != null ? String(r[P75]) : "",
        anio_actual: r.anio_actual != null ? String(r.anio_actual) : "",
    }));
}

async function fetchAtmZonalAnnualSeriesGeo(barrioNombre, cfg) {
    const years = getProductYears(cfg.productYearsKey);
    const MK = cfg.medianCol;
    const payloads = await Promise.all(
        years.map(async (y) => {
            const url = resolveAssetUrl(`${cfg.yearlyGeoBase}_${y}.geojson`);
            const gj = await fetchJson(url);
            if (!gj?.features?.length) return null;
            const feat = gj.features.find((f) => matchBarrio(f, barrioNombre));
            if (!feat?.properties) return null;
            const v = feat.properties[cfg.geoYearProp];
            if (v == null || v === "") return null;
            const num = +v;
            if (!Number.isFinite(num)) return null;
            const adj = convAfterParse(cfg, num);
            if (!Number.isFinite(adj)) return null;
            return {
                Year: +y,
                [MK]: adj,
                [cfg.p25Col]: null,
                [cfg.p75Col]: null,
            };
        }),
    );
    return payloads.filter(Boolean).sort((a, b) => a.Year - b.Year);
}

async function fetchAtmZonalMonthlyRowsGeojson(barrioNombre, cfg) {
    const base = cfg.monthlyGeoBase;
    const MK = cfg.medianCol;
    const rows = [];
    for (let m = 1; m <= 12; m++) {
        const mm = String(m).padStart(2, "0");
        const url = resolveAssetUrl(`${base}_${mm}.geojson`);
        const gj = await fetchJson(url);
        let val = null;
        if (gj?.features?.length) {
            const feat = gj.features.find((f) => matchBarrio(f, barrioNombre));
            const raw = feat?.properties?.[cfg.geoMonthProp];
            if (raw != null && raw !== "") {
                const num = +raw;
                if (Number.isFinite(num)) val = convAfterParse(cfg, num);
            }
        }
        rows.push({
            Month: String(m),
            [MK]: val != null ? String(val) : "",
            [cfg.p25Col]: "",
            [cfg.p75Col]: "",
        });
    }
    return rows;
}

async function fetchAtmZonalMonthlyCharts(barrioNombre, cfg, varKey) {
    const geoRows = await fetchAtmZonalMonthlyRowsGeojson(barrioNombre, cfg);
    const all = await loadAtmMZonalCsv(varKey);
    const entityRows = filterZonalMonthlyForEntity(all, barrioNombre);
    if (!entityRows.length) {
        return { rows: geoRows };
    }
    return { rows: mergeZonalMonthlyFromEngineCsv(entityRows, geoRows, cfg) };
}

/**
 * @returns {Promise<{ annual: Array<Record<string, unknown>>, monthlyRows: Array<Record<string, string>> }>}
 */
export async function fetchAtmZonalExplorerData(barrioNombre, varKey) {
    const cfg = ATM_CFG[varKey];
    if (!cfg) throw new Error(`ATM explorer: variable desconocida: ${varKey}`);
    const yearsSet = new Set(getProductYears(cfg.productYearsKey));
    const ymPath = GENIUS_YEARMONTH_CSV[cfg.ymCsvKey];
    const [bundle, yCsvAll, ymRows] = await Promise.all([
        loadZonalExplorerBundle(varKey),
        loadAtmYZonalCsv(varKey),
        geniusFetchYearMonthCsvOptional(ymPath),
    ]);
    const entityY = filterZonalMonthlyForEntity(yCsvAll, barrioNombre).filter((r) =>
        yearsSet.has(Math.round(+r.Year)),
    );

    const ent = getZonalBundleEntity(bundle, barrioNombre);
    let annual;
    /** @type {Array<Record<string, string>>} */
    let monthlyRows;
    if (ent) {
        annual = annualBundleToChart(ent.annual, cfg).filter((p) =>
            yearsSet.has(p.Year),
        );
        monthlyRows = monthlyBundleToRawRows(ent.monthly, cfg);
    } else {
        const [annualGeo, monthly] = await Promise.all([
            fetchAtmZonalAnnualSeriesGeo(barrioNombre, cfg),
            fetchAtmZonalMonthlyCharts(barrioNombre, cfg, varKey),
        ]);
        annual = annualGeo;
        monthlyRows = monthly.rows;
    }

    const annualMerged =
        entityY.length > 0 ? mergeZonalAnnualFromEngineCsv(annual, entityY, cfg) : annual;

    const ymFilter =
        varKey === "aod"
            ? geniusFilterAodYearMonthValue
            : varKey === "so2"
              ? (vv) => {
                    if (vv == null || !Number.isFinite(vv)) return null;
                    const u = so2UmolForDisplay(vv);
                    return u != null && Number.isFinite(u) ? u : null;
                }
              : null;
    let ymRowsSafe = ymRows ?? [];
    if (varKey === "so2") {
        ymRowsSafe = ymRowsSafe.filter((r) =>
            yearsSet.has(Math.round(+r.Year)),
        );
    }
    geniusFillMissingAnnualPctlFromYearMonth(annualMerged, ymRowsSafe, {
        ymValueKey: cfg.ymValueKey,
        p25Key: cfg.p25Col,
        p75Key: cfg.p75Col,
        medianKey: cfg.medianCol,
        filterValue: ymFilter,
    });
    geniusFillMissingMonthlyPctlInterannualFromYearMonth(monthlyRows, ymRowsSafe, {
        valueKey: cfg.ymValueKey,
        p25Key: cfg.p25Col,
        p75Key: cfg.p75Col,
        medianKey: cfg.medianCol,
        filterValue: ymFilter,
    });

    return { annual: annualMerged, monthlyRows };
}

/**
 * @param {AtmExplorerVar} varKey
 * @param {Record<string, string>} cfg
 */
function renderAnnualChart(container, data, cfg, varKey, titleText) {
    const MK = cfg.medianCol;
    const P25 = cfg.p25Col;
    const P75 = cfg.p75Col;

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

    svg.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("font-family", "Arial")
        .attr("class", GENIUS_CHART_HEADING_CLASS)
        .text(titleText);

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", innerWidth / 2)
        .attr("y", geniusAnnualAxisTitleY(innerHeight))
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Años");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -Math.max(42, Math.round(margin.left * 0.78)))
        .attr("x", -innerHeight / 2)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text(cfg.axisY);

    const [minY, maxY] = geniusAnnualPctlYExtent(data, MK, P25, P75);

    const x = d3
        .scaleBand()
        .domain(data.map((d) => d.Year))
        .range([0, innerWidth]);

    const xAxisG = svg.append("g").attr(
          "transform", `translate(0,${innerHeight})`);
    geniusConfigureAnnualBandYearAxis(xAxisG, x);

    const y = d3
        .scaleLinear()
        .domain([minY - 0.01, maxY + 0.01])
        .range([innerHeight, 0]);
    svg.append("g").call(d3.axisLeft(y));

    geniusAppendAnnualSeriesLegend(svg, {
        innerHeight,
        lineColor: ATM_CLIM_STEEL,
        bandFillColor: ATM_CLIM_STEEL,
        medianLabel: "Mediana anual (intra-anual)",
    });

    geniusAppendAnnualPctlBand(svg, {
        data,
        xBand: x,
        yearKey: "Year",
        y,
        p25Key: P25,
        p75Key: P75,
        fill: ATM_CLIM_STEEL,
    });

    const annualHoverPts = data.filter((d) => Number.isFinite(d[MK]));

    const line = d3
        .line()
        .defined((d) => Number.isFinite(d[MK]))
        .x((d) => x(d.Year) + x.bandwidth() / 2)
        .y((d) => y(d[MK]))
        .curve(d3.curveCatmullRom.alpha(0.5));

    const path = svg
        .append("path")
        .datum(data)
        .attr("fill", "none")
        .attr("stroke", ATM_CLIM_STEEL)
        .attr("stroke-width", 1.5)
        .attr("d", line);
    const len = path.node().getTotalLength();
    path.attr("stroke-dasharray", `${len} ${len}`)
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
        .attr("cy", (d) => y(d[MK]))
        .attr("r", 4)
        .attr("fill", ATM_CLIM_STEEL)
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
        panelId: container.id || "atm-explorer-annual",
        innerWidth,
        innerHeight,
        tooltip,
        points: annualHoverPts.map((d) => ({
            cx: x(d.Year) + x.bandwidth() / 2,
            cy: y(d[MK]),
            row: d,
            kind: "y",
        })),
        html: (p) => {
            const r = p.row;
            let s = `Año: ${r.Year}<br>${cfg.axisY} (P50 intra-anual): ${fmtTooltip(varKey, r[MK])}`;
            if (
                r[P25] != null &&
                r[P75] != null &&
                Number.isFinite(+r[P25]) &&
                Number.isFinite(+r[P75])
            ) {
                s += `<br>P25–P75: ${fmtTooltip(varKey, +r[P25])} – ${fmtTooltip(
                    varKey,
                    +r[P75],
                )}`;
            }
            return s;
        },
    });
}

/**
 * @param {AtmExplorerVar} varKey
 * @param {Record<string, string>} cfg
 */
async function renderMonthlyChart(container, rawRows, cfg, varKey, titleText) {
    const MK = cfg.medianCol;
    const P25 = cfg.p25Col;
    const P75 = cfg.p75Col;

    d3.select(container).selectAll("*").remove();
    const data = rawRows.map((d) => ({ ...d }));
    data.forEach((d) => {
        d.Month = +d.Month;
        const vm = geniusParseMonthlyMetric(String(d[MK] ?? ""));
        let midPl = vm != null ? convAfterParse(cfg, vm) : NaN;
        d._midPlot = midPl;
        if (d[P25] != null && String(d[P25]).trim() !== "") {
            const pr = geniusParseMonthlyMetric(String(d[P25]));
            d[P25] = pr != null ? convAfterParse(cfg, pr) : null;
        } else d[P25] = null;
        if (d[P75] != null && String(d[P75]).trim() !== "") {
            const pr = geniusParseMonthlyMetric(String(d[P75]));
            d[P75] = pr != null ? convAfterParse(cfg, pr) : null;
        } else d[P75] = null;
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

    svg.append("text")
        .attr("x", innerWidth / 2)
        .attr("y", -margin.top / 2)
        .attr("text-anchor", "middle")
        .style("font-size", "14px")
        .style("font-weight", "bold")
        .style("font-family", "Arial")
        .attr("class", GENIUS_CHART_HEADING_CLASS)
        .text(titleText);

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", innerWidth / 2)
        .attr("y", geniusMonthlyClimAxisTitleY(innerHeight))
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text("Meses");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -Math.max(42, Math.round(margin.left * 0.78)))
        .attr("x", -innerHeight / 2)
        .style("font-family", "Arial")
        .style("font-size", "12px")
        .text(cfg.axisY);

    const wall = geniusWallCalendarYearMonth();
    const ymKey = cfg.ymCsvKey;
    const ymCsvPath = GENIUS_YEARMONTH_CSV[ymKey];
    const ymRows = await geniusFetchYearMonthCsvOptional(ymCsvPath);
    /** Serie año actual desde CSV año–mes con misma escala que climatología (AOD heterogéneo). */
    let ymRowsAnio = ymRows ?? [];
    if (cfg.accentKey === "aod") {
        ymRowsAnio = ymRowsAnio.map((r) => {
            const v = geniusFilterAodYearMonthValue(
                geniusParseMonthlyMetric(String(r[cfg.ymValueKey] ?? "")),
            );
            return { ...r, [cfg.ymValueKey]: v != null ? String(v) : "" };
        });
    }

    const [minY0, maxY0] = geniusMonthlyPctlExtentMulti(data, [
        { mid: "_midPlot", p25: P25, p75: P75 },
    ]);

    const anioActual = geniusResolveAnioActualSeries({
        monthlyData: data,
        anioKey: GENIUS_ANIO_ACTUAL_CSV_KEY,
        ymRows: ymRowsAnio,
        ymKeys: {
            yearKey: "Year",
            monthKey: "Month",
            valueKey: cfg.ymValueKey,
        },
        wall,
        lstExcludedYearSlotsPredicate: null,
    });
    if (cfg.accentKey === "aod") {
        anioActual.points = anioActual.points.map((p) => ({
            ...p,
            v:
                p.v != null && Number.isFinite(+p.v)
                    ? geniusFilterAodYearMonthValue(+p.v)
                    : p.v,
        }));
    }
    if (cfg.accentKey === "so2") {
        anioActual.points = anioActual.points.map((p) => ({
            ...p,
            v:
                p.v != null && Number.isFinite(p.v)
                    ? convAfterParse(cfg, p.v)
                    : p.v,
        }));
    }

    const anioHasValues = anioActual.points.some(
        (p) => p.v != null && Number.isFinite(p.v),
    );
    const anioColor = geniusMonthlyAnioColor(cfg.accentKey);
    const [minY, maxY] = geniusExpandDomainWithPoints(
        minY0,
        maxY0,
        anioActual.points.map((p) => p.v),
    );

    const x = d3.scaleLinear().domain([1, 12]).range([0, innerWidth]);
    svg.append("g")
        .attr("transform", `translate(0,${innerHeight})`)
        .call(d3.axisBottom(x).ticks(12).tickFormat(d3.format("d")));

    const y = d3.scaleLinear().domain([minY - 0.01, maxY + 0.01]).range([innerHeight, 0]);
    svg.append("g").call(d3.axisLeft(y));

    geniusAppendMonthlyClimatologyLegend(svg, {
        innerWidth,
        innerHeight,
        placement: "belowAxis",
        climColor: ATM_CLIM_STEEL,
        bandFillColor: ATM_CLIM_STEEL,
        bandPctlLabel: "P25–P75 entre años (media zonal)",
        anioColor: anioHasValues ? anioColor : null,
        anioYear: anioHasValues ? anioActual.year : null,
    });

    geniusAppendMonthlyPctlBand(svg, {
        data,
        x: (d) => x(d.Month),
        y,
        p25Key: P25,
        p75Key: P75,
        fill: ATM_CLIM_STEEL,
        fillOpacity: 0.22,
    });

    const line = d3
        .line()
        .defined((d) => Number.isFinite(d._midPlot))
        .x((d) => x(d.Month))
        .y((d) => y(d._midPlot))
        .curve(d3.curveCatmullRom.alpha(0.5));

    const path = svg
        .append("path")
        .datum(data.filter((d) => Number.isFinite(d._midPlot)))
        .attr("fill", "none")
        .attr("stroke", ATM_CLIM_STEEL)
        .attr("stroke-width", 1.5)
        .attr("d", line);
    const node = path.node();
    if (node) {
        const totalLength = node.getTotalLength();
        path.attr("stroke-dasharray", `${totalLength} ${totalLength}`)
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
        .data(data.filter((d) => Number.isFinite(d._midPlot)))
        .enter()
        .append("circle")
        .attr("cx", (d) => x(d.Month))
        .attr("cy", (d) => y(d._midPlot))
        .attr("r", 4)
        .attr("fill", ATM_CLIM_STEEL)
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
        .filter((d) => Number.isFinite(d._midPlot))
        .map((d) => ({
            cx: x(d.Month),
            cy: y(d._midPlot),
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
        panelId: container.id || "atm-explorer-monthly",
        innerWidth,
        innerHeight,
        tooltip,
        points: [...hoverClim, ...hoverAnio],
        html: (p) => {
            if (p.kind === "anio") {
                const rv = p.row.v;
                return (
                    `Año actual (${anioActual.year}): ` +
                    (rv != null && Number.isFinite(rv)
                        ? fmtTooltip(varKey, rv)
                        : "—") +
                    `<br>Mes: ${p.row.Month}`
                );
            }
            const r = p.row;
            let h = `${cfg.axisY} (P50): ${fmtTooltip(varKey, r._midPlot)}<br>Mes: ${r.Month}`;
            if (
                r[P25] != null &&
                r[P75] != null &&
                !Number.isNaN(r[P25]) &&
                !Number.isNaN(r[P75])
            ) {
                h += `<br>P25: ${fmtTooltip(varKey, +r[P25])} &nbsp; P75: ${fmtTooltip(varKey, +r[P75])}`;
            }
            return h;
        },
    });
}

function ensureAtmModal() {
    let el = document.getElementById("atm-zonal-explorer-root");
    if (el) {
        const dlg = el.querySelector(".ndvi-zonal-explorer-dialog");
        if (dlg && !dlg.id) dlg.id = "atm-zonal-explorer-dialog";
        return el;
    }
    el = document.createElement("div");
    el.id = "atm-zonal-explorer-root";
    el.className = "ndvi-zonal-explorer-root";
    el.innerHTML = `
<div class="ndvi-zonal-explorer-backdrop" aria-hidden="true">
  <div id="atm-zonal-explorer-dialog" class="ndvi-zonal-explorer-dialog" role="dialog" aria-modal="true" aria-labelledby="atm-zonal-explorer-title">
    <button type="button" class="ndvi-zonal-explorer-close" aria-label="Cerrar">&times;</button>
    <h2 id="atm-zonal-explorer-title" class="ndvi-zonal-explorer-title"></h2>
    <div class="ndvi-zonal-explorer-loading" hidden>Cargando…</div>
    <div id="atm-explorer-annual" class="chart-container ndvi-zonal-explorer-chart"></div>
    <div id="atm-explorer-monthly" class="chart-container ndvi-zonal-explorer-chart"></div>
  </div>
</div>`;
    document.body.appendChild(el);
    el.querySelector(".ndvi-zonal-explorer-backdrop").addEventListener("click", (ev) => {
        if (ev.target.classList.contains("ndvi-zonal-explorer-backdrop")) closeAtmZonalExplorer();
    });
    el.querySelector(".ndvi-zonal-explorer-close").addEventListener("click", () =>
        closeAtmZonalExplorer(),
    );
    return el;
}

export function closeAtmZonalExplorer() {
    const root = document.getElementById("atm-zonal-explorer-root");
    if (!root) return;
    root.classList.remove("ndvi-zonal-explorer-root--open");
    const bd = root.querySelector(".ndvi-zonal-explorer-backdrop");
    if (bd) bd.setAttribute("aria-hidden", "true");
}

/**
 * @param {{ varKey: AtmExplorerVar, barrioNombre: string, labelTitle?: string }} opts
 */
export async function openAtmZonalExplorer({ varKey, barrioNombre, labelTitle }) {
    const cfg = ATM_CFG[varKey];
    if (!cfg) return;
    const root = ensureAtmModal();
    const titleEl = root.querySelector(".ndvi-zonal-explorer-title");
    const loadEl = root.querySelector(".ndvi-zonal-explorer-loading");
    const safeLabel = labelTitle || barrioNombre;
    titleEl.textContent = `${cfg.modalTitle} — ${safeLabel}`;
    root.classList.add("ndvi-zonal-explorer-root--open");
    const bd = root.querySelector(".ndvi-zonal-explorer-backdrop");
    if (bd) bd.setAttribute("aria-hidden", "false");
    loadEl.hidden = false;

    const annualEl = document.getElementById("atm-explorer-annual");
    const monthlyEl = document.getElementById("atm-explorer-monthly");
    annualEl.innerHTML = "";
    monthlyEl.innerHTML = "";

    try {
        const { annual, monthlyRows } = await fetchAtmZonalExplorerData(
            barrioNombre,
            varKey,
        );
        loadEl.hidden = true;
        renderAnnualChart(
            annualEl,
            annual,
            cfg,
            varKey,
            `${cfg.modalTitle} anual — ${safeLabel}`,
        );
        await renderMonthlyChart(
            monthlyEl,
            monthlyRows,
            cfg,
            varKey,
            `${cfg.modalTitle} mensual — ${safeLabel}`,
        );
    } catch (e) {
        console.error("atm_zonal_explorer", e);
        loadEl.hidden = true;
        annualEl.textContent = "No se pudieron cargar los datos.";
    }
}

function onAtmExploreClick(e) {
    const btn = e.target.closest("[data-atm-explore='barrio']");
    if (!btn) return;
    e.preventDefault();
    const v = /** @type {AtmExplorerVar} */ (btn.getAttribute("data-atm-var"));
    if (!ATM_CFG[v]) return;
    const enc = btn.getAttribute("data-barrio") || "";
    const nombre = decodeURIComponent(enc);
    openAtmZonalExplorer({ varKey: v, barrioNombre: nombre, labelTitle: nombre });
}

/** Delegación en document (popups MapLibre están fuera del panel del mapa). */
export function installAtmZonalExplorerHost() {
    if (atmExplorerHostInstalled) return;
    atmExplorerHostInstalled = true;
    document.body.addEventListener("click", onAtmExploreClick);
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAtmZonalExplorer();
    });
}

/**
 * @param {AtmExplorerVar} varKey
 */
export function atmBarrioPopupHtml(varKey, props) {
    const cfg = ATM_CFG[varKey];
    const nombre = props.NOMBRE ?? "";
    const enc = encodeURIComponent(String(nombre));
    return `
<div class="popup-title">${esc(nombre)}</div>
<div class="popup-row"><span class="popup-label">Año</span><span class="popup-value">${esc(props.Year)}</span></div>
<div class="popup-row"><span class="popup-label">${cfg.popupLabel}</span><span class="popup-value">${fmtPopupPrimary(varKey, props)}</span></div>
<div class="popup-actions"><button type="button" class="popup-explore-btn" data-atm-explore="barrio" data-atm-var="${varKey}" data-barrio="${enc}">Explorar series</button></div>`;
}

/**
 * @param {AtmExplorerVar} varKey
 */
export function atmBarrioPopupHtmlMonthly(varKey, props) {
    const cfg = ATM_CFG[varKey];
    const nombre = props.NOMBRE ?? "";
    const enc = encodeURIComponent(String(nombre));
    return `
<div class="popup-title">${esc(nombre)}</div>
<div class="popup-row"><span class="popup-label">Mes</span><span class="popup-value">${esc(props.Month)}</span></div>
<div class="popup-row"><span class="popup-label">${cfg.popupLabel}</span><span class="popup-value">${fmtPopupPrimaryMonthly(varKey, props)}</span></div>
<div class="popup-actions"><button type="button" class="popup-explore-btn" data-atm-explore="barrio" data-atm-var="${varKey}" data-barrio="${enc}">Explorar series</button></div>`;
}

/**
 * @param {AtmExplorerVar} varKey
 */
export function atmBarrioPopupHtmlTrend(varKey, props) {
    const nombre = props.NOMBRE ?? "";
    const enc = encodeURIComponent(String(nombre));
    const slope =
        props.slope_median != null && !Number.isNaN(Number(props.slope_median))
            ? esc(Number(props.slope_median).toFixed(4))
            : "Sin datos";
    return `
<div class="popup-title">${esc(nombre)}</div>
<div class="popup-row"><span class="popup-label">Tendencia</span><span class="popup-value">${slope}</span></div>
<div class="popup-actions"><button type="button" class="popup-explore-btn" data-atm-explore="barrio" data-atm-var="${varKey}" data-barrio="${enc}">Explorar series</button></div>`;
}
