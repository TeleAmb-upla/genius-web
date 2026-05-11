import { catalogYearBounds, downloadZipFromManifest } from './build_genius_zip.js';

const _endFb = new Date().getUTCFullYear() - 1;
const { startYear, endYear } = catalogYearBounds('no2', { startYear: 2019, endYear: _endFb });

const no2MonthlyFiles_tif = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/raster/NO2/NO2_Monthly/NO2_Monthly_${month}.tif`),
        name: `NO2_Monthly_${month}.tif`
    };
});

const no2YearlyFiles_tif = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/raster/NO2/NO2_Yearly/NO2_Yearly_${year}.tif`),
        name: `NO2_Yearly_${year}.tif`
    };
});

const no2ChartCsvUrban = [
    { url: resolveAssetUrl('assets/data/csv/NO2_y_urban.csv'), name: 'NO2_y_urban.csv' },
    { url: resolveAssetUrl('assets/data/csv/NO2_m_urban.csv'), name: 'NO2_m_urban.csv' },
    { url: resolveAssetUrl('assets/data/csv/NO2_YearMonth_urban.csv'), name: 'NO2_YearMonth_urban.csv' },
];

const no2TrendFiles_tif = [
    { url: resolveAssetUrl('assets/data/raster/NO2/NO2_Trend/NO2_Yearly_Trend.tif'), name: 'NO2_Trend.tif' },
    { url: resolveAssetUrl('assets/data/csv/NO2_m_zonal_barrios.csv'), name: 'NO2_m_zonal_barrios.csv' },
    ...no2ChartCsvUrban,
];

const no2MonthlyFiles_json_Barrio = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/geojson/NO2/NO2_Monthly_ZonalStats/NO2_Monthly_ZonalStats_Barrios/NO2_Monthly_ZonalStats_Barrios_${month}.geojson`),
        name: `NO2_Monthly_${month}.geojson`
    };
});

const no2YearlyFiles_json_Barrio = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/geojson/NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Barrios/NO2_Yearly_ZonalStats_Barrios_${year}.geojson`),
        name: `NO2_Yearly_${year}.geojson`
    };
});

const no2TrendFiles_json_Barrio = [
    { url: resolveAssetUrl('assets/data/geojson/NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Barrios/Trend_NO2_ZonalStats_Barrios.geojson'), name: 'NO2_Trend.geojson' },
    { url: resolveAssetUrl('assets/data/csv/NO2_m_zonal_barrios.csv'), name: 'NO2_m_zonal_barrios.csv' },
    ...no2ChartCsvUrban,
];

const no2MonthlyFiles_json_Manzanas = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/geojson/NO2/NO2_Monthly_ZonalStats/NO2_Monthly_ZonalStats_Manzanas/NO2_Monthly_ZonalStats_Manzanas_${month}.geojson`),
        name: `NO2_Monthly_${month}.geojson`
    };
});

const no2YearlyFiles_json_Manzanas = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/geojson/NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Manzanas/NO2_Yearly_ZonalStats_Manzanas_${year}.geojson`),
        name: `NO2_Yearly_${year}.geojson`
    };
});

const no2TrendFiles_json_Manzanas = [
    { url: resolveAssetUrl('assets/data/geojson/NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Manzanas/Trend_NO2_ZonalStats_Manzanas.geojson'), name: 'NO2_Trend.geojson' },
    { url: resolveAssetUrl('assets/data/csv/NO2_m_zonal_barrios.csv'), name: 'NO2_m_zonal_barrios.csv' },
    ...no2ChartCsvUrban,
];

const textFiles = [
    { url: resolveAssetUrl('assets/js/indicaciones.txt'), name: 'indicaciones.txt' },
];

const allno2Files = [...no2MonthlyFiles_tif, ...no2YearlyFiles_tif, ...no2TrendFiles_tif, ...textFiles];
const allno2Files_json_Barrio = [...no2MonthlyFiles_json_Barrio, ...no2YearlyFiles_json_Barrio, ...no2TrendFiles_json_Barrio, ...textFiles];
const allno2Files_json_Manzanas = [...no2MonthlyFiles_json_Manzanas, ...no2YearlyFiles_json_Manzanas, ...no2TrendFiles_json_Manzanas, ...textFiles];

export async function createAndDownloadno2Zip() {
    await downloadZipFromManifest(allno2Files, 'No2_Tif.zip');
}

export async function createAndDownloadno2Zip_json_Barrio() {
    await downloadZipFromManifest(allno2Files_json_Barrio, 'No2_Barrio.zip');
}

export async function createAndDownloadno2Zip_json_Manzanas() {
    await downloadZipFromManifest(allno2Files_json_Manzanas, 'No2_Manzanas.zip');
}
