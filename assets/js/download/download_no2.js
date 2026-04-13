
const startYear = 2019;
const endYear = 2024;

const no2MonthlyFiles_tif = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/raster/NO2/NO2_Monthly/NO2_Monthly_${month}.tif`),
        name: `NO2_Monthly_${month}.tif`
    };
});

const no2YearlyFiles_tif = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/raster/NO2/NO2_Yearly/NO2_Yearly_${year}.tif`),
        name: `NO2_Yearly_${year}.tif`
    };
});

const no2TrendFiles_tif = [
    { url: resolveAssetUrl('assets/data/raster/NO2/NO2_Trend/NO2_Yearly_Trend.tif'), name: 'NO2_Trend.tif' },
    { url: resolveAssetUrl('assets/data/csv/NO2_y_region.csv'), name: 'NO2_y_region.csv' },
    { url: resolveAssetUrl('assets/data/csv/NO2_m_region.csv'), name: 'NO2_m_region.csv' }
 ];

//////////////////////// BARRIO

const no2MonthlyFiles_json_Barrio = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/geojson/NO2/NO2_Monthly_ZonalStats/NO2_Monthly_ZonalStats_Barrios/NO2_Monthly_ZonalStats_Barrios_${month}.geojson`),
        name: `NO2_Monthly_${month}.geojson`
    };
});

const no2YearlyFiles_json_Barrio = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/geojson/NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Barrios/NO2_Yearly_ZonalStats_Barrios_${year}.geojson`),
        name: `NO2_Yearly_${year}.geojson`
    };
});

const no2TrendFiles_json_Barrio = [
    { url: resolveAssetUrl('assets/data/geojson/NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Barrios/Trend_NO2_ZonalStats_Barrios.geojson'), name: 'NO2_Trend.geojson' },
    { url: resolveAssetUrl('assets/data/csv/NO2_y_region.csv'), name: 'NO2_y_region.csv' },
    { url: resolveAssetUrl('assets/data/csv/NO2_m_region.csv'), name: 'NO2_m_region.csv' }
];

////////////////    MANZANAS

const no2MonthlyFiles_json_Manzanas = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: resolveAssetUrl(`assets/data/geojson/NO2/NO2_Monthly_ZonalStats/NO2_Monthly_ZonalStats_Manzanas/NO2_Monthly_ZonalStats_Manzanas_${month}.geojson`),
        name: `NO2_Monthly_${month}.geojson`
    };
});

const no2YearlyFiles_json_Manzanas = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: resolveAssetUrl(`assets/data/geojson/NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Manzanas/NO2_Yearly_ZonalStats_Manzanas_${year}.geojson`),
        name: `NO2_Yearly_${year}.geojson`
    };
});

const no2TrendFiles_json_Manzanas = [
    { url: resolveAssetUrl('assets/data/geojson/NO2/NO2_Yearly_ZonalStats/NO2_Yearly_ZonalStats_Manzanas/Trend_NO2_ZonalStats_Manzanas.geojson'), name: 'NO2_Trend.geojson' },
    { url: resolveAssetUrl('assets/data/csv/NO2_y_region.csv'), name: 'NO2_y_region.csv' },
    { url: resolveAssetUrl('assets/data/csv/NO2_m_region.csv'), name: 'NO2_m_region.csv' }
];


const textFiles = [
    { url: resolveAssetUrl('assets/js/indicaciones.txt'), name: 'indicaciones.txt' },
];



// Combina todos los archivos de NDVI en un solo array
const allno2Files = [...no2MonthlyFiles_tif, ...no2YearlyFiles_tif, ...no2TrendFiles_tif, ...textFiles];

const allno2Files_json_Barrio = [...no2MonthlyFiles_json_Barrio, ...no2YearlyFiles_json_Barrio, ...no2TrendFiles_json_Barrio, ...textFiles ];

const allno2Files_json_Manzanas = [...no2MonthlyFiles_json_Manzanas, ...no2YearlyFiles_json_Manzanas, ...no2TrendFiles_json_Manzanas, ...textFiles];


// Función para crear y descargar un archivo ZIP con todos los archivos TIF de NDVI
export async function createAndDownloadno2Zip() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of allno2Files) {
        try {
            const response = await fetch(file.url);
            if (!response.ok) throw new Error(`Error al cargar ${file.url}`);
            
            const data = await response.blob();
            zip.file(file.name, data);
        } catch (error) {
            console.error(`Error al agregar el archivo ${file.url}:`, error);
        }
    }

    // Generar el archivo ZIP y crear un enlace de descarga
    zip.generateAsync({ type: 'blob' }).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'No2_Tif.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}

// Función para crear y descargar un archivo ZIP con todos los archivos JSON de NDVI
export async function createAndDownloadno2Zip_json_Barrio() {
    const zip = new JSZip();

    // Agregar cada archivo JSON al ZIP
    for (const file of allno2Files_json_Barrio) {
        try {
            const response = await fetch(file.url);
            if (!response.ok) throw new Error(`Error al cargar ${file.url}`);
            
            const data = await response.blob();
            zip.file(file.name, data);
        } catch (error) {
            console.error(`Error al agregar el archivo ${file.url}:`, error);
        }
    }

    // Generar el archivo ZIP y crear un enlace de descarga
    zip.generateAsync({ type: 'blob' }).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'No2_Barrio.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}

// Función para crear y descargar un archivo ZIP con todos los archivos JSON de NDVI

export async function createAndDownloadno2Zip_json_Manzanas() {
    const zip = new JSZip();

    // Agregar cada archivo JSON al ZIP
    for (const file of allno2Files_json_Manzanas) {
        try {
            const response = await fetch(file.url);
            if (!response.ok) throw new Error(`Error al cargar ${file.url}`);
            
            const data = await response.blob();
            zip.file(file.name, data);
        } catch (error) {
            console.error(`Error al agregar el archivo ${file.url}:`, error);
        }
    }

    // Generar el archivo ZIP y crear un enlace de descarga
    zip.generateAsync({ type: 'blob' }).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'No2_Manzanas.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}
