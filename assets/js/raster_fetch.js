/**
 * Carga GeoTIFF desde assets vía resolveAssetUrl (index.html).
 * Devuelve null si el archivo no existe (404), red o parseo fallido.
 */
function resolveRasterFetchUrl(assetPath) {
    const resolver = typeof globalThis !== 'undefined' && globalThis.resolveAssetUrl;
    if (typeof resolver !== 'function') {
        console.error(
            '[GeoTIFF] Falta window.resolveAssetUrl: abra el sitio con index.html (no un módulo suelto) y sirva por HTTP.',
        );
        return null;
    }
    return resolver(assetPath);
}

export async function fetchGeoTiffArrayBuffer(assetPath) {
    const url = resolveRasterFetchUrl(assetPath);
    if (url == null) return null;

    let response;
    try {
        response = await fetch(url);
    } catch (err) {
        console.warn('[GeoTIFF] red:', url, err);
        return null;
    }
    if (!response.ok) {
        console.warn(`[GeoTIFF] HTTP ${response.status}: ${url}`);
        return null;
    }
    try {
        return await response.arrayBuffer();
    } catch (err) {
        console.warn('[GeoTIFF] arrayBuffer:', url, err);
        return null;
    }
}

/**
 * Prueba varias rutas en orden hasta que una responda 200.
 * Útil si los .tif de NDVI_Monthly tienen distintas convenciones de nombre.
 */
export async function fetchGeoTiffTryPaths(candidatePaths) {
    const resolver = typeof globalThis !== 'undefined' && globalThis.resolveAssetUrl;
    if (typeof resolver !== 'function') {
        console.error(
            '[GeoTIFF] Falta window.resolveAssetUrl: abra el sitio con index.html y sirva por HTTP.',
        );
        return null;
    }
    const list = Array.isArray(candidatePaths) ? candidatePaths : [];
    if (!list.length) return null;

    const triedUrls = [];
    for (const assetPath of list) {
        let url;
        try {
            url = resolver(assetPath);
        } catch {
            continue;
        }
        triedUrls.push(url);
        try {
            const response = await fetch(url);
            if (response.ok) {
                return await response.arrayBuffer();
            }
        } catch {
            /* siguiente candidato */
        }
    }
    const sample = triedUrls.slice(0, 2).join(' | ');
    console.warn(
        `[GeoTIFF] Ninguna de ${list.length} rutas respondió OK. Primeras URLs: ${sample}`,
    );
    return null;
}
