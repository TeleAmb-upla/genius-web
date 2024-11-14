// Definir las rutas de archivos TIF específicos de NDVI
const json = [
    { url: '/assets/vec/capas/3M_Class_Vector.geojson', name: 'iluminacion.geojson' },

];

// Función para crear y descargar un archivo ZIP con todos los archivos TIF de NDVI
export async function createAndDownloadiluZip() {
    const zip = new JSZip();

    // Agregar cada archivo TIF al ZIP
    for (const file of json) {
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
        link.download = 'Iluminacion.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}
