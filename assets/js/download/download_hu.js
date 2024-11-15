// Definir las rutas de archivos TIF específicos de hu


const huYearlyFiles_tif = Array.from({ length: 6 }, (_, i) => {
    const year = 2018 + i;
    return {
        url: `/assets/vec/raster/Huella_Urbana_Yearly/Huella_Urbana_Yearly_${year}.tif`,
        name: `Huella_Urbana_Yearly_${year}.tif`
    };
});

const hucvsFiles_tif = [
    { url: '/assets/csv/Huella_Urbana_Anual.csv', name: 'Huella_Urbana_Anual.csv' },
    { url: '/assets/csv/Areas_Huella_Urbana_Yearly.csv', name: 'Areas_Huella_Urbana.csv' }
];





// Combina todos los archivos de hu en un solo array
const allhuFiles = [...huYearlyFiles_tif, ...hucvsFiles_tif];

// Función para crear y descargar un archivo ZIP con todos los archivos TIF de hu
export async function createAndDownloadhuZip() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of allhuFiles) {
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
        link.download = 'Huella_Urbana.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}
