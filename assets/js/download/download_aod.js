import { catalogYearBounds, downloadZipFromManifest } from './build_genius_zip.js';

const _endFb = new Date().getUTCFullYear() - 1;
const { startYear, endYear } = catalogYearBounds('aod', { startYear: 2001, endYear: _endFb });

const aodMonthlyFiles_tif = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/raster/AOD/AOD_Monthly/AOD_Monthly_${month}.tif`),
        name: `AOD_Monthly_${month}.tif`
    };
});

const aodYearlyFiles_tif = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/raster/AOD/AOD_Yearly/AOD_Yearly_${year}.tif`),
        name: `AOD_Yearly_${year}.tif`
    };
});

const aodChartCsvUrban = [
    { url: resolveAssetUrl('assets/data/csv/AOD_y_urban.csv'), name: 'AOD_y_urban.csv' },
    { url: resolveAssetUrl('assets/data/csv/AOD_m_urban.csv'), name: 'AOD_m_urban.csv' },
    { url: resolveAssetUrl('assets/data/csv/AOD_YearMonth_urban.csv'), name: 'AOD_YearMonth_urban.csv' },
];

const aodTrendFiles_tif = [
    { url: resolveAssetUrl('assets/data/raster/AOD/AOD_Trend/AOD_Yearly_Trend.tif'), name: 'AOD_Trend.tif' },
    ...aodChartCsvUrban,
];

const aodMonthlyFiles_json_Barrio = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/geojson/AOD/AOD_Monthly_ZonalStats/AOD_Monthly_ZonalStats_Barrios/AOD_Monthly_ZonalStats_Barrios_${month}.geojson`),
        name: `AOD_Monthly_${month}.geojson`
    };
});

const aodYearlyFiles_json_Barrio = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/geojson/AOD/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Barrios/AOD_Yearly_ZonalStats_Barrios_${year}.geojson`),
        name: `AOD_Yearly_${year}.geojson`
    };
});

const aodTrendFiles_json_Barrio = [
    { url: resolveAssetUrl('assets/data/geojson/AOD/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Barrios/Trend_AOD_ZonalStats_Barrios.geojson'), name: 'AOD_Trend.geojson' },
    ...aodChartCsvUrban,
];

const aodMonthlyFiles_json_Manzanas = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/geojson/AOD/AOD_Monthly_ZonalStats/AOD_Monthly_ZonalStats_Manzanas/AOD_Monthly_ZonalStats_Manzanas_${month}.geojson`),
        name: `AOD_Monthly_${month}.geojson`
    };
});

const aodYearlyFiles_json_Manzanas = Array.from({ length: Math.max(0, endYear - startYear + 1) }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/geojson/AOD/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Manzanas/AOD_Yearly_ZonalStats_Manzanas_${year}.geojson`),
        name: `AOD_Yearly_${year}.geojson`
    };
});

const aodTrendFiles_json_Manzanas = [
    { url: resolveAssetUrl('assets/data/geojson/AOD/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Manzanas/Trend_AOD_ZonalStats_Manzanas.geojson'), name: 'AOD_Trend.geojson' },
    ...aodChartCsvUrban,
];

const textFiles = [
    { url: resolveAssetUrl('assets/js/indicaciones.txt'), name: 'indicaciones.txt' },
];

const allaodFiles = [...aodMonthlyFiles_tif, ...aodYearlyFiles_tif, ...aodTrendFiles_tif, ...textFiles];
const allaodFiles_json_Barrio = [...aodMonthlyFiles_json_Barrio, ...aodYearlyFiles_json_Barrio, ...aodTrendFiles_json_Barrio, ...textFiles];
const allaodFiles_json_Manzanas = [...aodMonthlyFiles_json_Manzanas, ...aodYearlyFiles_json_Manzanas, ...aodTrendFiles_json_Manzanas, ...textFiles];

export async function createAndDownloadAODZip() {
    await downloadZipFromManifest(allaodFiles, 'AOD_Tif.zip');
}

export async function createAndDownloadAODZip_json_Barrio() {
    await downloadZipFromManifest(allaodFiles_json_Barrio, 'AOD_Barrio.zip');
}

export async function createAndDownloadAODZip_json_Manzanas() {
    await downloadZipFromManifest(allaodFiles_json_Manzanas, 'AOD_Manzanas.zip');
}
