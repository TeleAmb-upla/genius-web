
import { map_2019 } from './js_anual/year_2019.js';
import { map_2020 } from './js_anual/year_2020.js';
import { map_2021 } from './js_anual/year_2021.js';
import { map_2022 } from './js_anual/year_2022.js';
import { map_2023 } from './js_anual/year_2023.js';
import { map_2024 } from './js_anual/year_2024.js';
import { map_2025 } from './js_anual/year_2025.js';
import { getProductYears } from '../../../map_data_catalog.js';
const Loaders = [
    map_2019,
    map_2020,
    map_2021,
    map_2022,
    map_2023,
    map_2024,
    map_2025
];


export async function loadLayersyear(map) {
    const years = getProductYears('so2');
    const Layers = {};
    const georasters = {};
    const settled = await Promise.allSettled(Loaders.map((loader) => loader(map)));
    settled.forEach((result, index) => {
        const year = years[index];
        if (result.status !== 'fulfilled') {
            console.warn(`SO2 ${year}:`, result.reason);
            return;
        }
        const data = result.value;
        if (!data || !data.layer) return;
        Layers[`SO² ${year}`] = data.layer;
        georasters[`SO² ${year}`] = data.georaster;
    });
    return { layers: Layers, georasters: georasters };
}
