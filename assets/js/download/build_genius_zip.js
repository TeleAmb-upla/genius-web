/**
 * Utilidades compartidas para ZIP de productos (alineado con catálogo y NDVI).
 */
import { getProductYears } from '../map_data_catalog.js';

/**
 * @param {string} productKey — clave en PRODUCT_YEARS (p. ej. 'lst', 'no2').
 * @param {{ startYear: number, endYear: number }} fallback
 */
export function catalogYearBounds(productKey, fallback) {
    const ys = getProductYears(productKey);
    if (ys.length >= 1) {
        return { startYear: ys[0], endYear: ys[ys.length - 1] };
    }
    return { ...fallback };
}

/**
 * @param {Array<{ url: string, name: string }>} files
 * @param {string} downloadName
 */
export async function downloadZipFromManifest(files, downloadName) {
    const zip = new JSZip();
    for (const file of files) {
        try {
            const response = await fetch(file.url);
            if (!response.ok) throw new Error(`Error al cargar ${file.url}`);
            const data = await response.blob();
            zip.file(file.name, data);
        } catch (error) {
            console.error(`Error al agregar el archivo ${file.url}:`, error);
        }
    }
    try {
        const content = await zip.generateAsync({ type: 'blob' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = downloadName;
        link.click();
        URL.revokeObjectURL(link.href);
    } catch (error) {
        console.error('Error al generar el ZIP:', error);
    }
}
