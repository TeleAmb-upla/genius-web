import { map_ndvi_2017 } from '../js_ndvi_anual/ndvi_2017.js';
import { map_ndvi_2018 } from '../js_ndvi_anual/ndvi_2018.js';
import { map_ndvi_2019 } from '../js_ndvi_anual/ndvi_2019.js';
import { map_ndvi_2020 } from '../js_ndvi_anual/ndvi_2020.js';
import { map_ndvi_2021 } from '../js_ndvi_anual/ndvi_2021.js';
import { map_ndvi_2022 } from '../js_ndvi_anual/ndvi_2022.js';
import { map_ndvi_2023 } from '../js_ndvi_anual/ndvi_2023.js';
import { map_ndvi_2024 } from '../js_ndvi_anual/ndvi_2024.js';
import { map_ndvi_2025 } from '../js_ndvi_anual/ndvi_2025.js';
import { getProductYears } from '../../../map_data_catalog.js';

const ndviLoaders = [
    map_ndvi_2017,
    map_ndvi_2018,
    map_ndvi_2019,
    map_ndvi_2020,
    map_ndvi_2021,
    map_ndvi_2022,
    map_ndvi_2023,
    map_ndvi_2024,
    map_ndvi_2025
];

export async function loadNdviLayersyear(map) {
    const years = getProductYears('ndvi');
    const ndviLayers = {};
    const georasters = {};

    const settled = await Promise.allSettled(ndviLoaders.map((loader) => loader(map)));
    settled.forEach((result, index) => {
        const year = years[index];
        if (result.status !== "fulfilled") {
            console.warn(`NDVI ${year}:`, result.reason);
            return;
        }
        const data = result.value;
        if (!data || !data.layer) return;
        ndviLayers[`NDVI ${year}`] = data.layer;
        georasters[`NDVI ${year}`] = data.georaster;
    });
    return { layers: ndviLayers, georasters: georasters };
}
