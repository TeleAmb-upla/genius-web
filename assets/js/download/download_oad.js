// Definir las rutas de archivos TIF específicos de NDVI

const startYear = 2001;
const endYear = 2023;

// Definir las rutas de archivos TIF específicos de lst
const aodMonthlyFiles_tif = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0'); // Genera '01', '02', ..., '12'
    return { 
        url: `/assets/vec/raster/aod_pixel/AOD_Monthly/AOD_Monthly_${month}.tif`,
        name: `AOD_Monthly_${month}.tif`
    };
});


const aodYearlyFiles_tif = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/raster/aod_pixel/AOD_Yearly/AOD_Yearly_${year}.tif`,
        name: `AOD_Yearly_${year}.tif`
    };
});


const aodTrendFiles_tif = [
    { url: '/assets/vec/raster/aod_pixel/AOD_Trend/AOD_Yearly_Trend.tif', name: 'AOD_Trend.tif' },
    { url: '/assets/vec/raster/aod_pixel/AOD_Monthly/AOD_Mensual.csv', name: 'AOD_Monthly.csv' },
    { url: '/assets/vec/raster/aod_pixel/AOD_Yearly/AOD_Anual.csv', name: 'AOD_Anual.csv' }
 ];



const aodMonthlyFiles_json_Barrio = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: `/assets/vec/vectoriales/AOD_Monthly_ZonalStats/AOD_Monthly_ZonalStats_Barrios/AOD_Monthly_ZonalStats_Barrios_${month}.geojson`,
        name: `AOD_Monthly_${month}.geojson`
    };
});

const aodYearlyFiles_json_Barrio = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/vectoriales/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Barrios/AOD_Yearly_ZonalStats_Barrios_${year}.geojson`,
        name: `AOD_Yearly_${year}.geojson`
    };
});


const aodTrendFiles_json_Barrio = [
    { url: '/assets/vec/vectoriales/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Barrios/Trend_AOD_ZonalStats_Barrios.geojson', name: 'AOD_Trend.geojson' },
    { url: '/assets/vec/raster/aod_pixel/AOD_Monthly/AOD_Mensual.csv', name: 'AOD_Monthly.csv' },
    { url: '/assets/vec/raster/aod_pixel/AOD_Yearly/AOD_Anual.csv', name: 'AOD_Anual.csv' }
];


const aodMonthlyFiles_json_Manzanas = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: `/assets/vec/vectoriales/AOD_Monthly_ZonalStats/AOD_Monthly_ZonalStats_Manzanas/AOD_Monthly_ZonalStats_Manzanas_${month}.geojson`,
        name: `AOD_Monthly_${month}.geojson`
    };
});

const aodYearlyFiles_json_Manzanas = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/vectoriales/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Manzanas/AOD_Yearly_ZonalStats_Manzanas_${year}.geojson`,
        name: `AOD_Yearly_${year}.geojson`
    };
});

const aodTrendFiles_json_Manzanas = [
    { url: '/assets/vec/vectoriales/AOD_Yearly_ZonalStats/AOD_Yearly_ZonalStats_Manzanas/Trend_AOD_ZonalStats_Manzanas.geojson', name: 'AOD_Trend.geojson' },
    { url: '/assets/vec/raster/aod_pixel/AOD_Monthly/AOD_Mensual.csv', name: 'AOD_Monthly.csv' },
    { url: '/assets/vec/raster/aod_pixel/AOD_Yearly/AOD_Anual.csv', name: 'AOD_Anual.csv' }
];

const textFiles = [
    { url: '/assets/js/indicaciones.txt', name: 'indicaciones.txt' },
];


// Combina todos los archivos de NDVI en un solo array
const allaodFiles = [...aodMonthlyFiles_tif, ...aodYearlyFiles_tif, ...aodTrendFiles_tif, ...textFiles];

const allaodFiles_json_Barrio = [...aodMonthlyFiles_json_Barrio, ...aodYearlyFiles_json_Barrio, ...aodTrendFiles_json_Barrio, ...textFiles ];

const allaodFiles_json_Manzanas = [...aodMonthlyFiles_json_Manzanas, ...aodYearlyFiles_json_Manzanas, ...aodTrendFiles_json_Manzanas,  ...textFiles];


// Función para crear y descargar un archivo ZIP con todos los archivos TIF de NDVI
export async function createAndDownloadAODZip() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of allaodFiles) {
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
        link.download = 'AOD_Tif.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}

export async function createAndDownloadAODZip_json_Barrio() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of allaodFiles_json_Barrio) {
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
        link.download = 'AOD_Barrio.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}


export async function createAndDownloadAODZip_json_Manzanas() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of allaodFiles_json_Manzanas) {
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
        link.download = 'AOD_Manzanas.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}