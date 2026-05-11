// Capas LST anuales: un `year_YYYY.js` por año con TIF en repo; años en catálogo (desde 1997).

import { getProductYears } from '../../map_data_catalog.js';

export async function loadLayersyear(map) {
    const years = getProductYears('lst');
    const Layers = {};
    const georasters = {};

    for (const year of years) {
        let loader;
        try {
            const mod = await import(`./js_anual/year_${year}.js`);
            loader = mod[`map_${year}`];
        } catch (err) {
            console.warn(`LST ${year}: no hay módulo ./js_anual/year_${year}.js`, err);
            continue;
        }
        if (typeof loader !== 'function') {
            console.warn(`LST ${year}: falta export map_${year}`);
            continue;
        }
        try {
            const data = await loader(map);
            if (!data || !data.layer) continue;
            Layers[`LST ${year}`] = data.layer;
            georasters[`LST ${year}`] = data.georaster;
        } catch (err) {
            console.warn(`LST ${year}:`, err);
        }
    }
    return { layers: Layers, georasters: georasters };
}
