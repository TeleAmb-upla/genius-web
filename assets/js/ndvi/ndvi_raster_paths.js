/**
 * Rutas candidatas para GeoTIFF NDVI en el mapa píxel.
 * Anual: solo NDVI_Yearly/NDVI_Yearly_*.tif. Tendencia: solo NDVI_Trend/ (un .tif).
 * En Google Drive las exportaciones usan carpetas distintas (NDVI_Yearly vs NDVI_Trend).
 * Mensual: climatología NDVI_Monthly_*.tif (serie año-mes en CSV, no raster).
 */
const base = 'assets/data/raster/NDVI';

export function candidatePathsNdviYearly(year) {
    const y = String(year);
    return [
        `${base}/NDVI_Yearly/NDVI_Yearly_${y}.tif`,
        `${base}/NDVI_Yearly/NDVI_Yearly_${y}.TIF`,
        `${base}/NDVI_Yearly/${y}.tif`,
        `${base}/NDVI_Yearly/${y}.TIF`,
    ];
}

export function candidatePathsNdviMonthly(monthNum) {
    const m = Number(monthNum);
    const mm = String(m).padStart(2, '0');
    const paths = [
        `${base}/NDVI_Monthly/NDVI_Monthly_${mm}.tif`,
        `${base}/NDVI_Monthly/NDVI_Monthly_${mm}.TIF`,
    ];
    if (m < 10) {
        paths.push(`${base}/NDVI_Monthly/NDVI_Monthly_${m}.tif`);
        paths.push(`${base}/NDVI_Monthly/NDVI_Monthly_${m}.TIF`);
    }
    return paths;
}

export function candidatePathsNdviTrend() {
    return [
        `${base}/NDVI_Trend/NDVI_Yearly_Trend.tif`,
        `${base}/NDVI_Trend/NDVI_Yearly_Trend.TIF`,
        `${base}/NDVI_Trend/NDVI_t_raster.tif`,
    ];
}

/**
 * Ventana de 2 años para NDVI mensual DE (misma lógica que ``download_ndvi.js``).
 * @returns {{ y0: number, y1: number }}
 */
export function getNdviMonthlyStdDevWindowYears() {
    const _nowUtc = new Date();
    const _lastCompleteMonthEndMs = Date.UTC(
        _nowUtc.getUTCFullYear(),
        _nowUtc.getUTCMonth(),
        0,
        23,
        59,
        59,
        999,
    );
    const _stdStartMs = _lastCompleteMonthEndMs - 730 * 86400000;
    const _stdYHi = new Date(_lastCompleteMonthEndMs).getUTCFullYear();
    const _stdYLo = new Date(_stdStartMs).getUTCFullYear();
    const y0 = Math.min(_stdYLo, _stdYHi);
    const y1 = Math.max(_stdYLo, _stdYHi);
    return { y0, y1 };
}

/**
 * Rutas candidatas para el GeoTIFF de desviación estándar (ventana móvil + respaldos).
 */
export function candidatePathsNdviMonthlyStdDev() {
    const sdBase = `${base}/NDVI_SD`;
    const { y0, y1 } = getNdviMonthlyStdDevWindowYears();
    return [
        `${sdBase}/NDVI_Monthly_StdDev_${y0}_${y1}.tif`,
        `${sdBase}/NDVI_Monthly_StdDev_${y0}_${y1}.TIF`,
        `${sdBase}/NDVI_Monthly_StdDev_2024_2026.tif`,
        `${sdBase}/NDVI_Monthly_StdDev_2024_2026.TIF`,
    ];
}
