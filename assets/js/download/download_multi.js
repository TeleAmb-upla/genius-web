// Definir las rutas de archivos TIF específicos de NDVI
const json = [
    { url: '/assets/vec/raster/multi/PlazaVieja_Dia_RGB.tif', name: 'PlazaVieja_Dia_RGB.tif' },
    { url: '/assets/vec/raster/multi/PlazaVieja_Dia_Termico.tif', name: 'PlazaVieja_Dia_Termico.tif' },
    { url: '/assets/vec/raster/multi/PlazaVieja_Noche_Class.geojson', name: 'PlazaVieja_Noche_Class.geojson' },

];

const textFiles = [
    { url: '/assets/js/indicaciones.txt', name: 'indicaciones.txt' },
];


//Combina todos los archivos de lst en un solo array
const allfiles = [...textFiles, ...json];



// Función para crear y descargar un archivo ZIP con todos los archivos TIF de NDVI
export async function createAndDownloadmultiZip() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of allfiles) {
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
        link.download = 'PlazaVieja_MultiCapa.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}
