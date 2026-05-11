/**
 * Layout uniforme para gráficos D3 en paneles .chart-container (index2).
 * Márgenes proporcionales al tamaño real del contenedor para que el trazo ocupe
 * siempre una fracción similar y título/ejes no se recorten con preserveAspectRatio.
 */
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7/+esm";

/** Título principal del gráfico (tipografía unificada en index2 vía index2-explorer.css). */
export const GENIUS_CHART_HEADING_CLASS = "ge-chart-heading";

export function getGeniusChartLayout(container) {
    let width = 400;
    let height = 280;
    if (container) {
        width = Math.max(200, container.clientWidth || container.offsetWidth || width);
        height = Math.max(180, container.clientHeight || container.offsetHeight || height);
    }

    /* Más aire: título, eje Y, etiquetas anuales rotadas y leyenda bajo el eje X */
    const top = Math.max(42, Math.round(height * 0.14));
    const bottom = Math.max(58, Math.round(height * 0.22));
    const left = Math.max(54, Math.round(width * 0.14));
    const right = Math.max(14, Math.round(width * 0.04));

    return {
        width,
        height,
        margin: { top, right, bottom, left },
    };
}

/**
 * Pie bajo el área de trazo (y = innerPlotBottom): ticks del eje X, título «Meses», leyenda climatología.
 * Coordenadas en el mismo sistema que el `<g>` interior (origen arriba-izquierda del trazo).
 */
export const GENIUS_MONTHLY_CLIM_FOOTER = Object.freeze({
    /** Sitio para etiquetas numéricas bajo el eje X. */
    tickBand: 44,
    /** Del título del eje X a la fila de la leyenda (título ~12px + separación). */
    xAxisTitleToLegend: 26,
    /** Segunda fila: «Año actual (aaaa)» bajo mediana + percentiles (evita recorte lateral). */
    legendSecondRow: 20,
});

/** Línea base del texto del título del eje X (p. ej. «Meses»), bajo los ticks. */
export function geniusMonthlyClimAxisTitleY(innerPlotBottom) {
    return innerPlotBottom + GENIUS_MONTHLY_CLIM_FOOTER.tickBand;
}

/** Origen Y del grupo de leyenda (debajo del título del eje X). */
export function geniusMonthlyClimLegendGroupY(innerPlotBottom) {
    const f = GENIUS_MONTHLY_CLIM_FOOTER;
    return innerPlotBottom + f.tickBand + f.xAxisTitleToLegend;
}

/** Margen inferior mínimo del SVG para que quepan ticks + título + leyenda sin recorte. */
export function geniusMonthlyClimMinBottom() {
    const f = GENIUS_MONTHLY_CLIM_FOOTER;
    return f.tickBand + f.xAxisTitleToLegend + 28 + f.legendSecondRow;
}

/** Título del eje X («Años») bajo los ticks, alineado con gráficos mensuales. */
export function geniusAnnualAxisTitleY(innerPlotBottom) {
    return innerPlotBottom + GENIUS_MONTHLY_CLIM_FOOTER.tickBand;
}

/** Margen inferior para ticks + «Años» + leyenda mediana / P25–P75 (sin fila «año actual»). */
export function geniusAnnualSeriesLegendMinBottom() {
    const f = GENIUS_MONTHLY_CLIM_FOOTER;
    return f.tickBand + f.xAxisTitleToLegend + 32;
}

/**
 * Eje X para ``d3.scaleBand`` de años: menos marcas en series largas + rotación legible.
 * @param {import('d3').Selection} axisG — grupo con ``transform`` en ``y = innerHeight``
 * @param {import('d3').ScaleBand<number | string>} xBand
 */
export function geniusConfigureAnnualBandYearAxis(axisG, xBand) {
    const domain = xBand.domain();
    const n = domain.length;
    const step =
        n <= 12 ? 1 : n <= 18 ? 2 : n <= 28 ? 3 : n <= 40 ? 4 : Math.ceil(n / 10);
    const tickVals = domain.filter((_, i) => i % step === 0);
    axisG.call(
        d3.axisBottom(xBand).tickValues(tickVals).tickFormat(d3.format("d")),
    );
    axisG
        .selectAll("text")
        .attr("transform", "rotate(-48)")
        .style("text-anchor", "end")
        .attr("dx", "-0.28em")
        .attr("dy", "0.7em")
        .style("font-size", "10px");
    axisG.selectAll("path, line").style("stroke", "#94a3b8");
}
