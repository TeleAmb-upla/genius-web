
const startYear = 2019;
const endYear = 2024;


/////
const  so2MonthlyFiles_tif = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: `/assets/vec/raster/so2_pixel/SO2_Monthly/SO2_Monthly_${month}.tif`,
        name: `so2_Monthly_${month}.tif`
    };
});

const so2YearlyFiles_tif = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/raster/so2_pixel/SO2_Yearly/SO2_Yearly_${year}.tif`,
        name: `SO2_Yearly_${year}.tif`
    };
});

const so2TrendFiles_tif = [
    { url: '/assets/vec/raster/so2_pixel/SO2_Trend/SO2_Yearly_Trend.tif', name: 'SO2_Trend.tif' },
    { url: '/assets/csv/SO2_Mensual_Comunal.csv', name: 'SO2_Monthly.csv' },
    { url: '/assets/csv/SO2_Anual_Comunal.csv', name: 'SO2_Anual.csv' }
 ];

// //////////////////////// BARRIO

const so2MonthlyFiles_json_Barrio = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: `/assets/vec/vectoriales/SO2_Monthly_ZonalStats/SO2_Monthly_ZonalStats_Barrios/SO2_Monthly_ZonalStats_Barrios_${month}.geojson`,
        name: `SO2_Monthly_${month}.geojson`
    };
});

const so2YearlyFiles_json_Barrio = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/vectoriales/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Barrios/SO2_Yearly_ZonalStats_Barrios_${year}.geojson`,
        name: `SO2_Yearly_${year}.geojson`
    };
});

const so2TrendFiles_json_Barrio = [
    { url: '/assets/vec/vectoriales/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Barrios/Trend_SO2_ZonalStats_Barrios.geojson', name: 'SO2_Trend.geojson' },
    { url: '/assets/csv/SO2_Mensual_Comunal.csv', name: 'SO2_Monthly.csv' },
    { url: '/assets/csv/SO2_Anual_Comunal.csv', name: 'SO2_Anual.csv' }
];

// /// Manzanas

const so2MonthlyFiles_json_Manzanas = Array.from({ length: 12 }, (_, i) => {
    const month = String(i + 1).padStart(2, '0');
    return {
        url: `/assets/vec/vectoriales/SO2_Monthly_ZonalStats/SO2_Monthly_ZonalStats_Manzanas/SO2_Monthly_ZonalStats_Manzanas_${month}.geojson`,
        name: `SO2_Monthly_${month}.geojson`
    };
}
);

const so2YearlyFiles_json_Manzanas = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/vectoriales/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Manzanas/SO2_Yearly_ZonalStats_Manzanas_${year}.geojson`,
        name: `SO2_Yearly_${year}.geojson`
    };
}
);

const so2TrendFiles_json_Manzanas = [
    { url: '/assets/vec/vectoriales/SO2_Yearly_ZonalStats/SO2_Yearly_ZonalStats_Manzanas/Trend_SO2_ZonalStats_Manzanas.geojson', name: 'SO2_Trend.geojson' },
    { url: '/assets/csv/SO2_Mensual_Comunal.csv', name: 'SO2_Monthly.csv' },
    { url: '/assets/csv/SO2_Anual_Comunal.csv', name: 'SO2_Anual.csv' }
];


const textFiles = [
    { url: '/assets/js/indicaciones.txt', name: 'indicaciones.txt' },
];


// Combina todos los archivos de so2 en un solo array
const allso2Files = [...so2MonthlyFiles_tif, ...so2YearlyFiles_tif, ...so2TrendFiles_tif, ...textFiles];
// Combina todos los archivos de so2 en un solo array
const allso2Files_json_Barrio = [...so2MonthlyFiles_json_Barrio, ...so2YearlyFiles_json_Barrio, ...so2TrendFiles_json_Barrio, ...textFiles ];
// Combina todos los archivos de so2 en un solo array

const allso2Files_json_Manzanas = [...so2MonthlyFiles_json_Manzanas, ...so2YearlyFiles_json_Manzanas, ...so2TrendFiles_json_Manzanas, ...textFiles];

// Función para crear y descargar un archivo ZIP con todos los archivos TIF de so2
export async function createAndDownloadso2Zip() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of allso2Files) {
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
        link.download = 'SO2_Tif_comprimidos.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}


// Función para crear y descargar un archivo ZIP con todos los archivos JSON de so2
export async function createAndDownloadso2Zip_json_Barrio() {
    const zip = new JSZip();

    // Agregar cada archivo JSON al ZIP
    for (const file of allso2Files_json_Barrio) {
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
        link.download = 'SO2_Json_Barrio.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}

// Función para crear y descargar un archivo ZIP con todos los archivos JSON de so2
export async function createAndDownloadso2Zip_json_Manzanas() {
    const zip = new JSZip();

    // Agregar cada archivo JSON al ZIP
    for (const file of allso2Files_json_Manzanas) {
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
        link.download = 'SO2_Json_Manzanas.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}