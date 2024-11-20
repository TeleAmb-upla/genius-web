
const startYear = 1997;
const endYear = 2023;

const islaYearlyFiles_json = Array.from({ length: endYear - startYear + 1 }, (_, i) => {
    const year = startYear + i;
    return {
        url: `/assets/vec/vectoriales/LST_SUHI_Yearly/LST_SUHI_Yearly_${year}.geojson`,
        name: `Isla_de_calor_${year}.geojson`
    };
});



export async function createAndDownloadislaZip() {
    const zip = new JSZip();

    for (const file of islaYearlyFiles_json) {
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
        link.download = 'Isla_de_calor.zip';
        link.click();

        URL.revokeObjectURL(link.href);
    }).catch(error => console.error('Error al generar el ZIP:', error));
}