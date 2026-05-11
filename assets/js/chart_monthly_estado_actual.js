/**
 * Serie «año actual» en gráficos mensuales (1–12): valores hasta el **último mes civil
 * completo** (Chile para ATM), desde `anio_actual` del CSV mensual y huecos desde el
 * CSV año–mes cuando aplique. Si falta el mes en el año del muro, se usa el **último año**
 * disponible en el año–mes con ese mismo mes civil y año ``≤`` año del muro (p. ej. abril 2025
 * si abril 2026 aún no está exportado).
 */
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";
import { geniusParseMonthlyMetric } from "./chart_monthly_pctl_band.js";
import { geniusMonthlyClimLegendGroupY } from "./chart_layout_genius.js";

/** Cabecera CSV (ASCII) para la columna «año actual» generada en GEE. */
export const GENIUS_ANIO_ACTUAL_CSV_KEY = "anio_actual";

/** Rutas de CSV año–mes (tras exportar / sincronizar desde Drive). */
export const GENIUS_YEARMONTH_CSV = {
    aodUrban: "assets/data/csv/AOD_YearMonth_urban.csv",
    no2Urban: "assets/data/csv/NO2_YearMonth_urban.csv",
    so2Urban: "assets/data/csv/SO2_YearMonth_urban.csv",
    lstUrban: "assets/data/csv/LST_YearMonth_urban.csv",
    /** Serie urbana año–mes (export en repo bajo raster/NDVI, no en csv/). */
    ndviUrban: "assets/data/raster/NDVI/NDVI_YearMonth/NDVI_YearMonth_urban.csv",
};

/**
 * Último **mes civil completo** en `America/Santiago` (Quilpué): según la fecha actual,
 * no un mes fijo. Ej.: 15-abr-2026 → marzo 2026; 3-may-2026 → abril 2026.
 * La serie «año actual» en ATM/LST zonal usa este tope hasta ``month`` inclusive.
 */
export function geniusWallCalendarYearMonth() {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Santiago",
        year: "numeric",
        month: "numeric",
    }).formatToParts(now);
    const ys = parts.find((p) => p.type === "year")?.value;
    const ms = parts.find((p) => p.type === "month")?.value;
    const cy = ys != null ? parseInt(ys, 10) : NaN;
    const cm = ms != null ? parseInt(ms, 10) : NaN;
    if (!Number.isFinite(cy) || !Number.isFinite(cm) || cm < 1 || cm > 12) {
        const y = now.getUTCFullYear();
        const mo = now.getUTCMonth() + 1;
        if (mo === 1) return { year: y - 1, month: 12 };
        return { year: y, month: mo - 1 };
    }
    if (cm === 1) return { year: cy - 1, month: 12 };
    return { year: cy, month: cm - 1 };
}

/**
 * Mismo criterio que ``last_complete_calendar_month_utc`` en GEE para ``NDVI_m_urban`` y
 * ``NDVI_m_zonal_*``: año del último mes civil cerrado (UTC) y ese mes como tope inclusive.
 * En enero → ``{ year: añoPrevio, month: 12 }`` (12 meses con ``anio_actual`` en el CSV).
 * ``geniusWallCalendarYearMonth`` usa Chile (último mes completo); NDVI sigue en UTC vía esta función.
 */
export function geniusWallNdviAnioActualFromCsv() {
    const now = new Date();
    const y = now.getUTCFullYear();
    const mo = now.getUTCMonth() + 1;
    if (mo === 1) {
        return { year: y - 1, month: 12 };
    }
    return { year: y, month: mo - 1 };
}

/**
 * @param {string} relPath
 * @returns {Promise<Array<Record<string, string>> | null>}
 */
export async function geniusFetchYearMonthCsvOptional(relPath) {
    const url =
        typeof resolveAssetUrl === "function"
            ? resolveAssetUrl(relPath)
            : relPath;
    try {
        const res = await fetch(url);
        if (!res.ok) return null;
        const text = await res.text();
        return d3.csvParse(text);
    } catch {
        return null;
    }
}

/**
 * @param {Array<Record<string, string>>} data — filas CSV mensual (Month + anio_actual)
 * @param {string} anioKey
 * @param {number} wallMonth — último mes del año actual a incluir
 * @returns {Array<{ Month: number, v: number }>}
 */
export function geniusLinePointsFromMonthlyColumn(data, anioKey, wallMonth) {
    if (!data?.length || !anioKey) return [];
    const pts = [];
    for (const d of data) {
        const Month = +d.Month;
        if (Month < 1 || Month > wallMonth) continue;
        const v = geniusParseMonthlyMetric(d[anioKey]);
        if (v == null) continue;
        pts.push({ Month, v });
    }
    pts.sort((a, b) => a.Month - b.Month);
    return pts;
}

/**
 * @param {Array<Record<string, string>> | null | undefined} ymRows
 * @param {{ yearKey: string, monthKey: string, valueKey: string }} keys
 */
export function geniusLinePointsFromYearMonth(
    ymRows,
    keys,
    targetYear,
    monthCapInclusive,
) {
    if (!ymRows?.length) return [];
    const { yearKey, monthKey, valueKey } = keys;
    const pts = [];
    for (const r of ymRows) {
        const y = Math.round(+r[yearKey]);
        if (y !== targetYear) continue;
        const m = Math.round(+r[monthKey]);
        if (m < 1 || m > monthCapInclusive) continue;
        const v = geniusParseMonthlyMetric(r[valueKey]);
        if (v == null) continue;
        pts.push({ Month: m, v });
    }
    pts.sort((a, b) => a.Month - b.Month);
    return pts;
}

/**
 * @param {object} opts
 * @param {Array<Record<string, string>>} opts.monthlyData
 * @param {string | null | undefined} opts.anioKey — p. ej. GENIUS_ANIO_ACTUAL_CSV_KEY
 * @param {Array<Record<string, string>> | null | undefined} opts.ymRows
 * @param {{ yearKey: string, monthKey: string, valueKey: string } | null | undefined} opts.ymKeys
 * @param {{ year: number, month: number }} opts.wall
 * @param {(year: number) => boolean | null | undefined} [opts.lstExcludedYearSlotsPredicate] — si coincide,
 *        devuelve un punto por mes (1…wall.month) con ``v: null`` para dejar hueco en la línea del año actual (LST).
 *
 * Prioridad por mes (1…``wall.month``): valor válido en ``anio_actual`` del CSV mensual;
 * si falta o es sentinela, el valor del CSV año–mes para ese mes civil usando el **mayor año**
 * ``≤`` año del muro con dato válido (prioriza el año del muro cuando existe).
 */
export function geniusResolveAnioActualSeries({
    monthlyData,
    anioKey,
    ymRows,
    ymKeys,
    wall,
    lstExcludedYearSlotsPredicate = null,
}) {
    const yWall = Math.round(+wall.year);
    const mWall = Math.round(+wall.month);
    if (
        typeof lstExcludedYearSlotsPredicate === "function" &&
        lstExcludedYearSlotsPredicate(yWall)
    ) {
        const pts = [];
        for (let m = 1; m <= mWall; m++) pts.push({ Month: m, v: null });
        return { points: pts, year: wall.year, monthCap: wall.month };
    }

    /** @type {Map<number, number>} */
    const byMonth = new Map();

    const sampleRow = monthlyData?.[0];
    const hasAnioCol = !!(
        anioKey &&
        sampleRow &&
        Object.prototype.hasOwnProperty.call(sampleRow, anioKey)
    );

    if (hasAnioCol && monthlyData?.length) {
        for (const d of monthlyData) {
            const Month = Math.round(+d.Month);
            if (Month < 1 || Month > mWall) continue;
            const v = geniusParseMonthlyMetric(d[anioKey]);
            if (v != null && Number.isFinite(v)) byMonth.set(Month, v);
        }
    }

    if (ymRows?.length && ymKeys) {
        const { yearKey, monthKey, valueKey } = ymKeys;
        for (let m = 1; m <= mWall; m++) {
            if (byMonth.has(m)) continue;
            let bestY = -Infinity;
            let bestV = null;
            for (const r of ymRows) {
                const y = Math.round(+r[yearKey]);
                const mo = Math.round(+r[monthKey]);
                if (mo !== m || y > yWall) continue;
                const v = geniusParseMonthlyMetric(r[valueKey]);
                if (v == null || !Number.isFinite(v)) continue;
                if (y > bestY) {
                    bestY = y;
                    bestV = v;
                }
            }
            if (bestV != null) byMonth.set(m, bestV);
        }
    }

    const points = [...byMonth.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([Month, v]) => ({ Month, v }));

    return {
        points,
        year: wall.year,
        monthCap: wall.month,
    };
}

/**
 * @param {number} lo
 * @param {number} hi
 * @param {Iterable<number | null | undefined>} pointValues
 * @param {number} padRatio
 */
export function geniusExpandDomainWithPoints(lo, hi, pointValues, padRatio = 0.04) {
    const nums = [...pointValues].filter(
        (v) => v != null && Number.isFinite(v),
    );
    if (!nums.length) return [lo, hi];
    let a = Math.min(lo, ...nums);
    let b = Math.max(hi, ...nums);
    const span = b - a || Math.abs(a) * 0.02 || 1;
    const pad = span * padRatio;
    return [a - pad, b + pad];
}

/**
 * Leyenda climatología + año actual.
 * @param {import('d3').Selection} svg — grupo interior ya trasladado por márgenes
 * @param {"topRight" | "belowAxis"} [opts.placement] — con ``belowAxis`` la leyenda va bajo el título del eje X (p. ej. «Meses»)
 * @param {number} [opts.innerHeight] — requerido si ``placement === "belowAxis"`` (borde inferior del área de trazo, y = innerHeight)
 * @param {string} [opts.bandPctlLabel] — texto de la banda sombreada (default «Percentiles 25–75»)
 */
export function geniusAppendMonthlyClimatologyLegend(svg, opts) {
    const {
        innerWidth,
        innerHeight: plotBottom,
        climColor = "steelblue",
        bandFillColor = "steelblue",
        anioColor,
        anioYear,
        anchorY = 2,
        placement = "topRight",
        bandPctlLabel = "Percentiles 25–75",
    } = opts;
    const fs = "10px";
    const font = "Arial, sans-serif";

    if (placement === "belowAxis" && plotBottom != null) {
        const g = svg
            .append("g")
            .attr("class", "ge-monthly-clim-legend-below")
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
            .attr("stroke", climColor)
            .attr("stroke-width", 1.6);
        g.append("circle")
            .attr("cx", x + 10)
            .attr("cy", y)
            .attr("r", 2.8)
            .attr("fill", climColor);
        g.append("text")
            .attr("x", x + 26)
            .attr("y", y + 4)
            .attr("text-anchor", "start")
            .style("font-size", fs)
            .style("font-family", font)
            .text("Mediana mensual (climatología)");
        x += 26 + 168 + sep;

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
            .text(bandPctlLabel);

        if (anioColor != null && anioYear != null) {
            const y2 = 18;
            let ax = 0;
            g.append("line")
                .attr("x1", ax)
                .attr("x2", ax + 20)
                .attr("y1", y2)
                .attr("y2", y2)
                .attr("stroke", anioColor)
                .attr("stroke-width", 2);
            g.append("circle")
                .attr("cx", ax + 10)
                .attr("cy", y2)
                .attr("r", 2.8)
                .attr("fill", anioColor);
            g.append("text")
                .attr("x", ax + 26)
                .attr("y", y2 + 4)
                .attr("text-anchor", "start")
                .style("font-size", fs)
                .style("font-family", font)
                .text(`Año actual (${anioYear})`);
        }
        return;
    }

    const g = svg.append("g").attr("class", "ge-monthly-clim-legend");
    const xRight = innerWidth - 4;
    let y = anchorY;
    const rowGap = 14;

    g.append("line")
        .attr("x1", xRight - 26)
        .attr("x2", xRight)
        .attr("y1", y)
        .attr("y2", y)
        .attr("stroke", climColor)
        .attr("stroke-width", 1.6);
    g.append("circle")
        .attr("cx", xRight - 13)
        .attr("cy", y)
        .attr("r", 3)
        .attr("fill", climColor);
    g.append("text")
        .attr("x", xRight - 30)
        .attr("y", y + 4)
        .attr("text-anchor", "end")
        .style("font-size", fs)
        .style("font-family", font)
        .text("Mediana mensual (climatología)");

    y += rowGap;
    g.append("rect")
        .attr("x", xRight - 26)
        .attr("y", y - 5)
        .attr("width", 26)
        .attr("height", 10)
        .attr("fill", bandFillColor)
        .attr("fill-opacity", 0.22)
        .attr("stroke", "none");
    g.append("text")
        .attr("x", xRight - 30)
        .attr("y", y + 4)
        .attr("text-anchor", "end")
        .style("font-size", fs)
        .style("font-family", font)
        .text(bandPctlLabel);

    y += rowGap;
    if (anioColor != null && anioYear != null) {
        g.append("line")
            .attr("x1", xRight - 26)
            .attr("x2", xRight)
            .attr("y1", y)
            .attr("y2", y)
            .attr("stroke", anioColor)
            .attr("stroke-width", 2);
        g.append("circle")
            .attr("cx", xRight - 13)
            .attr("cy", y)
            .attr("r", 3)
            .attr("fill", anioColor);
        g.append("text")
            .attr("x", xRight - 30)
            .attr("y", y + 4)
            .attr("text-anchor", "end")
            .style("font-size", fs)
            .style("font-family", font)
            .text(`Año actual (${anioYear})`);
    }
}

/**
 * @param {import('d3').Selection} svgInner
 * @param {object} opts
 * @param {(d: { Month: number, v: number }) => number} opts.xPos
 * @param {import('d3').ScaleContinuousNumeric<number, number>} opts.y
 * @param {Array<{ Month: number, v: number }>} opts.points
 * @param {string} opts.color
 */
export function geniusAppendAnioActualLine(svgInner, opts) {
    const {
        xPos,
        y,
        points,
        color,
        strokeWidth = 2,
        dotR = 3.5,
        showDots = true,
    } = opts;
    if (!points?.length) return;
    const line = d3
        .line()
        .defined((d) => d.v != null && Number.isFinite(d.v))
        .x((d) => xPos(d))
        .y((d) => y(d.v))
        .curve(d3.curveMonotoneX);
    svgInner
        .append("path")
        .datum(points)
        .attr("fill", "none")
        .attr("stroke", color)
        .attr("stroke-width", strokeWidth)
        .attr("class", "ge-anio-actual-line")
        .attr("d", line);
    if (!showDots) return;
    const dotted = points.filter((d) => d.v != null && Number.isFinite(d.v));
    if (!dotted.length) return;
    svgInner
        .append("g")
        .attr("class", "ge-anio-actual-dots")
        .selectAll("circle")
        .data(dotted)
        .enter()
        .append("circle")
        .attr("cx", (d) => xPos(d))
        .attr("cy", (d) => y(d.v))
        .attr("r", dotR)
        .attr("fill", color)
        .attr("pointer-events", "none");
}

const _MES_NOMBRE = [
    "",
    "ene",
    "feb",
    "mar",
    "abr",
    "may",
    "jun",
    "jul",
    "ago",
    "sep",
    "oct",
    "nov",
    "dic",
];

/**
 * @param {number} monthCap
 */
export function geniusYtdMonthRangeLabel(monthCap) {
    if (monthCap < 1) return "";
    const hi = _MES_NOMBRE[monthCap] || String(monthCap);
    return monthCap <= 1 ? "ene" : `ene–${hi}`;
}
