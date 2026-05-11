import { catalogYearBounds, downloadZipFromManifest } from './build_genius_zip.js';

const _endFb = new Date().getUTCFullYear() - 1;
const { startYear, endYear } = catalogYearBounds('ndvi_raster', { startYear: 2017, endYear: _endFb });
const { startYear: zStart, endYear: zEnd } = catalogYearBounds('ndvi_zonal', { startYear: 2017, endYear: _endFb });
const _ny = Math.max(0, endYear - startYear + 1);
const _nz = Math.max(0, zEnd - zStart + 1);

const _nowUtc = new Date();
const _lastCompleteMonthEndMs = Date.UTC(
    _nowUtc.getUTCFullYear(),
    _nowUtc.getUTCMonth(),
    0,
    23,
    59,
    59,
    999
);
const _stdStartMs = _lastCompleteMonthEndMs - 730 * 86400000;
const _stdYHi = new Date(_lastCompleteMonthEndMs).getUTCFullYear();
const _stdYLo = new Date(_stdStartMs).getUTCFullYear();
const ndviStdDevY0 = Math.min(_stdYLo, _stdYHi);
const ndviStdDevY1 = Math.max(_stdYLo, _stdYHi);

const ndviMonthlyFiles_tif = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/raster/NDVI/NDVI_Monthly/NDVI_Monthly_${month}.tif`),
        name: `NDVI_Monthly_${month}.tif`
    };
});

const ndviYearlyFiles_tif = Array.from({ length: _ny }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/raster/NDVI/NDVI_Yearly/NDVI_Yearly_${year}.tif`),
        name: `NDVI_Yearly_${year}.tif`
    };
});

const ndviTrendFiles_tif = [
    { url: resolveAssetUrl('assets/data/raster/NDVI/NDVI_Trend/NDVI_Yearly_Trend.tif'), name: 'NDVI_Trend.tif' },
    { url: resolveAssetUrl(`assets/data/raster/NDVI/NDVI_SD/NDVI_Monthly_StdDev_${ndviStdDevY0}_${ndviStdDevY1}.tif`), name: `NDVI_StdDev_${ndviStdDevY0}_${ndviStdDevY1}.tif` },
    { url: resolveAssetUrl('assets/data/csv/NDVI_m_urban.csv'), name: 'NDVI_Monthly.csv' },
    { url: resolveAssetUrl('assets/data/csv/NDVI_y_urban.csv'), name: 'NDVI_Anual.csv' },
    { url: resolveAssetUrl('assets/data/csv/NDVI_m_av.csv'), name: 'NDVI_Monthly_AV.csv' },
    { url: resolveAssetUrl('assets/data/csv/NDVI_y_av.csv'), name: 'NDVI_Anual_AV.csv' }
];

const ndviMonthlyFiles_json_Barrio = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/geojson/NDVI/NDVI_Monthly_ZonalStats/NDVI_Monthly_ZonalStats_Barrios/NDVI_Monthly_ZonalStats_Barrios_${month}.geojson`),
        name: `NDVI_Monthly_${month}.geojson`
    };
});

const ndviYearlyFiles_json_Barrio = Array.from({ length: _nz }, (_, i) => {
    const year = zStart + i;
    return {
        url: resolveAssetUrl(`assets/data/geojson/NDVI/NDVI_Yearly_ZonalStats/NDVI_Yearly_ZonalStats_Barrios/NDVI_Yearly_ZonalStats_Barrios_${year}.geojson`),
        name: `NDVI_Yearly_${year}.geojson`
    };
});

const ndviTrendFiles_json_Barrio = [
    { url: resolveAssetUrl('assets/data/geojson/NDVI/NDVI_Yearly_ZonalStats/NDVI_Yearly_ZonalStats_Barrios/Trend_NDVI_ZonalStats_Barrios.geojson'), name: 'NDVI_Trend.geojson' },
    { url: resolveAssetUrl('assets/data/csv/NDVI_m_urban.csv'), name: 'NDVI_Monthly.csv' },
    { url: resolveAssetUrl('assets/data/csv/NDVI_y_urban.csv'), name: 'NDVI_Anual.csv' },
    { url: resolveAssetUrl('assets/data/csv/NDVI_m_av.csv'), name: 'NDVI_Monthly_AV.csv' },
    { url: resolveAssetUrl('assets/data/csv/NDVI_y_av.csv'), name: 'NDVI_Anual_AV.csv' }
];

const ndviMonthlyFiles_json_Manzanas = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/geojson/NDVI/NDVI_Monthly_ZonalStats/NDVI_Monthly_ZonalStats_Manzanas/NDVI_Monthly_ZonalStats_Manzanas_${month}.geojson`),
        name: `NDVI_Monthly_${month}.geojson`
    };
});

const ndviYearlyFiles_json_Manzanas = Array.from({ length: _nz }, (_, i) => {
    const year = zStart + i;
    return {
        url: resolveAssetUrl(`assets/data/geojson/NDVI/NDVI_Yearly_ZonalStats/NDVI_Yearly_ZonalStats_Manzanas/NDVI_Yearly_ZonalStats_Manzanas_${year}.geojson`),
        name: `NDVI_Yearly_${year}.geojson`
    };
});

const ndviTrendFiles_json_Manzanas = [
    { url: resolveAssetUrl('assets/data/geojson/NDVI/NDVI_Yearly_ZonalStats/NDVI_Yearly_ZonalStats_Manzanas/Trend_NDVI_ZonalStats_Manzanas.geojson'), name: 'NDVI_Trend.geojson' },
    { url: resolveAssetUrl('assets/data/csv/NDVI_m_urban.csv'), name: 'NDVI_Monthly.csv' },
    { url: resolveAssetUrl('assets/data/csv/NDVI_y_urban.csv'), name: 'NDVI_Anual.csv' },
    { url: resolveAssetUrl('assets/data/csv/NDVI_m_av.csv'), name: 'NDVI_Monthly_AV.csv' },
    { url: resolveAssetUrl('assets/data/csv/NDVI_y_av.csv'), name: 'NDVI_Anual_AV.csv' }
];

const textFiles = [
    { url: resolveAssetUrl('assets/js/indicaciones.txt'), name: 'indicaciones.txt' },
];

const allNdviFiles_tif = [...ndviMonthlyFiles_tif, ...ndviYearlyFiles_tif, ...ndviTrendFiles_tif, ...textFiles];
const allNdviFiles_json_Barrio = [...ndviMonthlyFiles_json_Barrio, ...ndviYearlyFiles_json_Barrio, ...ndviTrendFiles_json_Barrio, ...textFiles];
const allNdviFiles_json_Manzanas = [...ndviMonthlyFiles_json_Manzanas, ...ndviYearlyFiles_json_Manzanas, ...ndviTrendFiles_json_Manzanas, ...textFiles];

export async function createAndDownloadNDVIZip_tif() {
    await downloadZipFromManifest(allNdviFiles_tif, 'NDVI_Tif.zip');
}

export async function createAndDownloadNDVIZip_json_Barrio() {
    await downloadZipFromManifest(allNdviFiles_json_Barrio, 'NDVI_Json_Barrio.zip');
}

export async function createAndDownloadNDVIZip_json_Manzanas() {
    await downloadZipFromManifest(allNdviFiles_json_Manzanas, 'NDVI_Json_Manzanas.zip');
}
