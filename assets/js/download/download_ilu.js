const iluminacionFiles = [
    { url: resolveAssetUrl('assets/data/vectores/Quilpue_Class_Smoothed.webp'), name: 'iluminacion_clasificacion.webp' },
    { url: resolveAssetUrl('assets/js/indicaciones.txt'), name: 'indicaciones.txt' },
];

export async function createAndDownloadiluZip() {
    const zip = new JSZip();

    for (const file of iluminacionFiles) {
        try {
            const response = await fetch(file.url);
            if (!response.ok) throw new Error(`Error al cargar ${file.url}`);
            const data = await response.blob();
            zip.file(file.name, data);
        } catch (error) {
            console.error(`Error al agregar el archivo ${file.url}:`, error);
        }
    }

    zip.generateAsync({ type: 'blob' }).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = 'Iluminacion.zip';
        link.click();
        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}
