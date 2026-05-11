import { catalogYearBounds, downloadZipFromManifest } from './build_genius_zip.js';

const _endFb = new Date().getUTCFullYear() - 1;
const { startYear, endYear } = catalogYearBounds('so2', { startYear: 2019, endYear: _endFb });

const so2MonthlyFiles_tif = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/raster/SO2/SO2_Monthly/SO2_Monthly_${month}.tif`),
        name: `so2_Monthly_${month}.tif`
    };
});

const so2YearlyFiles_tif = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/raster/SO2/SO2_Yearly/SO2_Yearly_${year}.tif`),
        name: `SO2_Yearly_${year}.tif`
    };
});

const so2ChartCsvUrban = [
    { url: resolveAssetUrl('assets/data/csv/SO2_y_urban.csv'), name: 'SO2_y_urban.csv' },
    { url: resolveAssetUrl('assets/data/csv/SO2_m_urban.csv'), name: 'SO2_m_urban.csv' },
    { url: resolveAssetUrl('assets/data/csv/SO2_YearMonth_urban.csv'), name: 'SO2_YearMonth_urban.csv' },
];

const so2TrendFiles_tif = [
    { url: resolveAssetUrl('assets/data/raster/SO2/SO2_Trend/SO2_Yearly_Trend.tif'), name: 'SO2_Trend.tif' },
    { url: resolveAssetUrl('assets/data/csv/SO2_m_zonal_barrios.csv'), name: 'SO2_m_zonal_barrios.csv' },
    ...so2ChartCsvUrban,
];

const so2MonthlyFiles_json_Barrio = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/geojson/SO2/SO2_Monthly_ZonalStats/SO2_Monthly_ZonalStats_Barrios/SO2_Monthly_ZonalStats_Barrios_${month}.geojson`),
        name: `SO2_Monthly_${month}.geojson`
    };
});

const so2YearlyFiles_json_Barrio = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/geojson/SO2/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Barrios/SO2_Yearly_ZonalStats_Barrios_${year}.geojson`),
        name: `SO2_Yearly_${year}.geojson`
    };
});

const so2TrendFiles_json_Barrio = [
    { url: resolveAssetUrl('assets/data/geojson/SO2/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Barrios/Trend_SO2_ZonalStats_Barrios.geojson'), name: 'SO2_Trend.geojson' },
    { url: resolveAssetUrl('assets/data/csv/SO2_m_zonal_barrios.csv'), name: 'SO2_m_zonal_barrios.csv' },
    ...so2ChartCsvUrban,
];

const so2MonthlyFiles_json_Manzanas = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/geojson/SO2/SO2_Monthly_ZonalStats/SO2_Monthly_ZonalStats_Manzanas/SO2_Monthly_ZonalStats_Manzanas_${month}.geojson`),
        name: `SO2_Monthly_${month}.geojson`
    };
});

const so2YearlyFiles_json_Manzanas = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/geojson/SO2/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Manzanas/SO2_Yearly_ZonalStats_Manzanas_${year}.geojson`),
        name: `SO2_Yearly_${year}.geojson`
    };
});

const so2TrendFiles_json_Manzanas = [
    { url: resolveAssetUrl('assets/data/geojson/SO2/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Manzanas/Trend_SO2_ZonalStats_Manzanas.geojson'), name: 'SO2_Trend.geojson' },
    { url: resolveAssetUrl('assets/data/csv/SO2_m_zonal_barrios.csv'), name: 'SO2_m_zonal_barrios.csv' },
    ...so2ChartCsvUrban,
];

const textFiles = [
    { url: resolveAssetUrl('assets/js/indicaciones.txt'), name: 'indicaciones.txt' },
];

const allso2Files = [...so2MonthlyFiles_tif, ...so2YearlyFiles_tif, ...so2TrendFiles_tif, ...textFiles];
const allso2Files_json_Barrio = [...so2MonthlyFiles_json_Barrio, ...so2YearlyFiles_json_Barrio, ...so2TrendFiles_json_Barrio, ...textFiles];
const allso2Files_json_Manzanas = [...so2MonthlyFiles_json_Manzanas, ...so2YearlyFiles_json_Manzanas, ...so2TrendFiles_json_Manzanas, ...textFiles];

export async function createAndDownloadso2Zip() {
    await downloadZipFromManifest(allso2Files, 'So2_Tif.zip');
}

export async function createAndDownloadso2Zip_json_Barrio() {
    await downloadZipFromManifest(allso2Files_json_Barrio, 'So2_Barrio.zip');
}

export async function createAndDownloadso2Zip_json_Manzanas() {
    await downloadZipFromManifest(allso2Files_json_Manzanas, 'So2_Manzanas.zip');
}
