
const startYear = 2017;
const endYear = 2024;

// Definir las rutas de archivos TIF específicos de NDVI
const ndviMonthlyFiles_tif = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0'); // Genera '01', '02', ..., '12'
    return {
        url: `/assets/vec/raster/NDVI_pixel/NDVI_Monthly/NDVI_Monthly_${month}.tif`,
        name: `NDVI_Monthly_${month}.tif`
    };
});


const ndviYearlyFiles_tif = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/raster/NDVI_pixel/NDVI_Yearly/NDVI_Yearly_${year}.tif`,
        name: `NDVI_Yearly_${year}.tif`
    };
});


const ndviTrendFiles_tif = [
    { url: '/assets/vec/raster/NDVI_pixel/NDVI_Trend/NDVI_Yearly_Trend.tif', name: 'NDVI_Trend.tif' },
    { url:'/assets/vec/raster/NDVI_pixel/NDVI_StdDev/NDVI_Monthly_StdDev_2024_2025.tif', name: 'NDVI_StdDev_2024_2025.tif' },
    { url: '/assets/csv/NDVI_m_urban.csv', name: 'NDVI_Monthly.csv' },
    { url: '/assets/csv/NDVI_y_urban.csv', name: 'NDVI_Anual.csv' },
     { url: '/assets/csv/NDVI_m_av.csv', name: 'NDVI_Monthly_AV.csv' },
    { url: '/assets/csv/NDVI_y_av.csv', name: 'NDVI_Anual_AV.csv' }
 ];

//////////////////////// BARRIO
const ndviMonthlyFiles_json_Barrio = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0'); // Asegura que el mes tenga dos dígitos
    return {
        url: `/assets/vec/vectoriales/NDVI_Monthly_ZonalStats_Barrios/NDVI_Monthly_ZonalStats_Barrios_${month}.geojson`,
        name: `NDVI_Monthly_${month}.geojson`
    };
});


const ndviYearlyFiles_json_Barrio = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/vectoriales/NDVI_Yearly_ZonalStats_Barrios/NDVI_Yearly_ZonalStats_Barrios_${year}.geojson`,
        name: `NDVI_Yearly_${year}.geojson`
    };
});


const ndviTrendFiles_json_Barrio = [
    { url: '/assets/vec/vectoriales/NDVI_Yearly_ZonalStats_Barrios/Trend_NDVI_ZonalStats_Barrios.geojson', name: 'NDVI_Trend.geojson' },
    { url: '/assets/csv/NDVI_m_urban.csv', name: 'NDVI_Monthly.csv' },
    { url: '/assets/csv/NDVI_y_urban.csv', name: 'NDVI_Anual.csv' },
     { url: '/assets/csv/NDVI_m_av.csv', name: 'NDVI_Monthly_AV.csv' },
    { url: '/assets/csv/NDVI_y_av.csv', name: 'NDVI_Anual_AV.csv' }
];
///
const ndviMonthlyFiles_json_Manzanas = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: `/assets/vec/vectoriales/NDVI_Monthly_ZonalStats_Manzanas/NDVI_Monthly_ZonalStats_Manzanas_${month}.geojson`,
        name: `NDVI_Monthly_${month}.geojson`
    };
});


const ndviYearlyFiles_json_Manzanas = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/vectoriales/NDVI_Yearly_ZonalStats_Manzanas/NDVI_Yearly_ZonalStats_Manzanas_${year}.geojson`,
        name: `NDVI_Yearly_${year}.geojson`
    };
});

const ndviTrendFiles_json_Manzanas = [
    { url: '/assets/vec/vectoriales/NDVI_Yearly_ZonalStats_Manzanas/Trend_NDVI_ZonalStats_Manzanas.geojson', name: 'NDVI_Trend.geojson' },
 { url: '/assets/csv/NDVI_m_urban.csv', name: 'NDVI_Monthly.csv' },
    { url: '/assets/csv/NDVI_y_urban.csv', name: 'NDVI_Anual.csv' },
     { url: '/assets/csv/NDVI_m_av.csv', name: 'NDVI_Monthly_AV.csv' },
    { url: '/assets/csv/NDVI_y_av.csv', name: 'NDVI_Anual_AV.csv' }
];


const textFiles = [
    { url: '/assets/js/indicaciones.txt', name: 'indicaciones.txt' },
];




// Combina todos los archivos de NDVI en un solo array PARA TIFF
const allNdviFiles_tif = [...ndviMonthlyFiles_tif, ...ndviYearlyFiles_tif, ...ndviTrendFiles_tif, ...textFiles];
// Combina todos los archivos de NDVI en un solo array PARA TIFF
const allNdviFiles_json_Barrio = [...ndviMonthlyFiles_json_Barrio, ...ndviYearlyFiles_json_Barrio, ...ndviTrendFiles_json_Barrio, ...textFiles ];
// Combina todos los archivos de NDVI en un solo array PARA TIFF
const allNdviFiles_json_Manzanas = [...ndviMonthlyFiles_json_Manzanas, ...ndviYearlyFiles_json_Manzanas, ...ndviTrendFiles_json_Manzanas, ...textFiles];





// Función para crear y descargar un archivo ZIP con todos los archivos TIF de NDVI
export async function createAndDownloadNDVIZip_tif() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of allNdviFiles_tif) {
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
        link.download = 'NDVI_Tif.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}


// Función para crear y descargar un archivo ZIP con todos los archivos TIF de NDVI
export async function createAndDownloadNDVIZip_json_Barrio() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of allNdviFiles_json_Barrio) {
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
        link.download = 'NDVI_Json_Barrio.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}



// Función para crear y descargar un archivo ZIP con todos los archivos TIF de NDVI
export async function createAndDownloadNDVIZip_json_Manzanas() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of allNdviFiles_json_Manzanas) {
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
        link.download = 'NDVI_Json_Manzanas.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}