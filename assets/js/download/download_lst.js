
const startYear = 1997;
const endYear = 2024;



// Definir las rutas de archivos TIF específicos de lst
const lstMonthlyFiles_tif = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0'); // Genera '01', '02', ..., '12'
    return { 
        url: `/assets/vec/raster/lst_pixel/lst_Monthly/LST_Monthly_${month}.tif`,
        name: `LST_Monthly_${month}.tif`
    };
});

const lstYearlyFiles_tif = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/raster/lst_pixel/lst_Yearly/LST_Yearly_${year}.tif`,
        name: `LST_Yearly_${year}.tif`
    };
});

const lstTrendFiles_tif = [
    { url: '/assets/vec/raster/lst_pixel/lst_Trend/LST_Yearly_Trend.tif', name: 'LST_Trend.tif' },
    { url: '/assets/csv/LST_m_urban.csv', name: 'LST_Monthly.csv' },
    { url: '/assets/csv/LST_y_urban.csv', name: 'LST_Anual.csv' }
 ];


///////////////// BARRIo

const lstMonthlyFiles_json_Barrio = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: `/assets/vec/vectoriales/LST_Monthly_ZonalStats_Barrios/LST_Monthly_ZonalStats_Barrios_${month}.geojson`,
        name: `LST_Monthly_${month}.geojson`
    };
});

const lstYearlyFiles_json_Barrio = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/vectoriales/LST_Yearly_ZonalStats_Barrios/LST_Yearly_ZonalStats_Barrios_${year}.geojson`,
        name: `LST_Yearly_${year}.geojson`
    };
});

const lstTrendFiles_json_Barrio = [
    { url: '/assets/vec/vectoriales/LST_Yearly_ZonalStats_Barrios/Trend_LST_ZonalStats_Barrios.geojson', name: 'LST_Trend.geojson' },
    { url: '/assets/csv/LST_m_urban.csv', name: 'LST_Monthly.csv' },
    { url: '/assets/csv/LST_y_urban.csv', name: 'LST_Anual.csv' }
];


const lstMonthlyFiles_json_Manzanas = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: `/assets/vec/vectoriales/LST_Monthly_ZonalStats_Manzanas/LST_Monthly_ZonalStats_Manzanas_${month}.geojson`,
        name: `LST_Monthly_${month}.geojson`
    };
});

const lstYearlyFiles_json_Manzanas = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/vectoriales/LST_Yearly_ZonalStats_Manzanas/LST_Yearly_ZonalStats_Manzanas_${year}.geojson`,
        name: `LST_Yearly_${year}.geojson`
    };
});
const lstTrendFiles_json_Manzanas = [
    { url: '/assets/vec/vectoriales/LST_Yearly_ZonalStats_Barrios/Trend_LST_ZonalStats_Barrios.geojson', name: 'LST_Trend.geojson' },
    { url: '/assets/csv/LST_m_urban.csv', name: 'LST_Monthly.csv' },
    { url: '/assets/csv/LST_y_urban.csv', name: 'LST_Anual.csv' }
];

const textFiles = [
    { url: '/assets/js/indicaciones.txt', name: 'indicaciones.txt' },
];


// Combina todos los archivos de lst en un solo array
const alllstFiles_tif = [...lstMonthlyFiles_tif, ...lstYearlyFiles_tif, ...lstTrendFiles_tif, ...textFiles];

// Combina todos los archivos de lst en un solo array

const alllstFiles_json_Barrio = [...lstMonthlyFiles_json_Barrio, ...lstYearlyFiles_json_Barrio, ...lstTrendFiles_json_Barrio, ...textFiles];

// Combina todos los archivos de lst en un solo array

const alllstFiles_json_Manzanas = [...lstMonthlyFiles_json_Manzanas, ...lstYearlyFiles_json_Manzanas, ...lstTrendFiles_json_Manzanas, ...textFiles];


// Función para crear y descargar un archivo ZIP con todos los archivos TIF de lst
export async function createAndDownloadlstZip_tif_lst() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of alllstFiles_tif) {
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
        link.download = 'lst_Tif.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}

export async function createAndDownloadlstZip_json_Barrios_lst() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of alllstFiles_json_Barrio) {
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
        link.download = 'lst_Tif.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}

export async function createAndDownloadlstZip_json_Manzanas_lst() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of alllstFiles_json_Manzanas) {
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
        link.download = 'lst_Tif.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}