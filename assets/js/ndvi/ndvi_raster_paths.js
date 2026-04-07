/**
 * Rutas candidatas para GeoTIFF NDVI en el mapa píxel.
 * Mensual: solo climatología NDVI_Monthly_*.tif (la serie año-mes va por CSV, no por raster).
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
