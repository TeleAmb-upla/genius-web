import { getProductYears } from '../map_data_catalog.js';
import { downloadZipFromManifest } from './build_genius_zip.js';

/** Años LST según catálogo (unión de TIF / GeoJSON / CSV en disco). */
const _lstZipYears = getProductYears('lst');

// Definir las rutas de archivos TIF específicos de lst
const lstMonthlyFiles_tif = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/raster/LST/LST_Monthly/LST_Monthly_${month}.tif`),
        name: `LST_Monthly_${month}.tif`
    };
});

const lstYearlyFiles_tif = _lstZipYears.map((year) => ({
    url: resolveAssetUrl(`assets/data/raster/LST/LST_Yearly/LST_Yearly_${year}.tif`),
    name: `LST_Yearly_${year}.tif`,
}));

const lstTrendFiles_tif = [
    { url: resolveAssetUrl('assets/data/raster/LST/LST_Trend/LST_Yearly_Trend.tif'), name: 'LST_Trend.tif' },
    { url: resolveAssetUrl('assets/data/csv/LST_m_urban.csv'), name: 'LST_Monthly.csv' },
    { url: resolveAssetUrl('assets/data/csv/LST_y_urban.csv'), name: 'LST_Anual.csv' }
];

const lstMonthlyFiles_json_Barrio = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/geojson/LST/LST_Monthly_ZonalStats/LST_Monthly_ZonalStats_Barrios/LST_Monthly_ZonalStats_Barrios_${month}.geojson`),
        name: `LST_Monthly_${month}.geojson`
    };
});

const lstYearlyFiles_json_Barrio = _lstZipYears.map((year) => ({
    url: resolveAssetUrl(
        `assets/data/geojson/LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Barrios/LST_Yearly_ZonalStats_Barrios_${year}.geojson`,
    ),
    name: `LST_Yearly_${year}.geojson`,
}));

const lstTrendFiles_json_Barrio = [
    { url: resolveAssetUrl('assets/data/geojson/LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Barrios/Trend_LST_ZonalStats_Barrios.geojson'), name: 'LST_Trend.geojson' },
    { url: resolveAssetUrl('assets/data/csv/LST_m_urban.csv'), name: 'LST_Monthly.csv' },
    { url: resolveAssetUrl('assets/data/csv/LST_y_urban.csv'), name: 'LST_Anual.csv' }
];

const lstMonthlyFiles_json_Manzanas = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/geojson/LST/LST_Monthly_ZonalStats/LST_Monthly_ZonalStats_Manzanas/LST_Monthly_ZonalStats_Manzanas_${month}.geojson`),
        name: `LST_Monthly_${month}.geojson`
    };
});

const lstYearlyFiles_json_Manzanas = _lstZipYears.map((year) => ({
    url: resolveAssetUrl(
        `assets/data/geojson/LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Manzanas/LST_Yearly_ZonalStats_Manzanas_${year}.geojson`,
    ),
    name: `LST_Yearly_${year}.geojson`,
}));

const lstTrendFiles_json_Manzanas = [
    { url: resolveAssetUrl('assets/data/geojson/LST/LST_Yearly_ZonalStats/LST_Yearly_ZonalStats_Manzanas/Trend_LST_ZonalStats_Manzanas.geojson'), name: 'LST_Trend.geojson' },
    { url: resolveAssetUrl('assets/data/csv/LST_m_urban.csv'), name: 'LST_Monthly.csv' },
    { url: resolveAssetUrl('assets/data/csv/LST_y_urban.csv'), name: 'LST_Anual.csv' }
];

const textFiles = [
    { url: resolveAssetUrl('assets/js/indicaciones.txt'), name: 'indicaciones.txt' },
];

const alllstFiles_tif = [...lstMonthlyFiles_tif, ...lstYearlyFiles_tif, ...lstTrendFiles_tif, ...textFiles];
const alllstFiles_json_Barrio = [...lstMonthlyFiles_json_Barrio, ...lstYearlyFiles_json_Barrio, ...lstTrendFiles_json_Barrio, ...textFiles];
const alllstFiles_json_Manzanas = [...lstMonthlyFiles_json_Manzanas, ...lstYearlyFiles_json_Manzanas, ...lstTrendFiles_json_Manzanas, ...textFiles];

export async function createAndDownloadlstZip_tif_lst() {
    await downloadZipFromManifest(alllstFiles_tif, 'lst_Tif.zip');
}

export async function createAndDownloadlstZip_json_Barrios_lst() {
    await downloadZipFromManifest(alllstFiles_json_Barrio, 'lst_Json_Barrio.zip');
}

export async function createAndDownloadlstZip_json_Manzanas_lst() {
    await downloadZipFromManifest(alllstFiles_json_Manzanas, 'lst_Json_Manzanas.zip');
}
