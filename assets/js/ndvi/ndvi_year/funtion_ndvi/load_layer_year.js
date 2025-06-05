import { map_ndvi_2017 } from '../js_ndvi_anual/ndvi_2017.js';
import { map_ndvi_2018 } from '../js_ndvi_anual/ndvi_2018.js';
import { map_ndvi_2019 } from '../js_ndvi_anual/ndvi_2019.js';
import { map_ndvi_2020 } from '../js_ndvi_anual/ndvi_2020.js';
import { map_ndvi_2021 } from '../js_ndvi_anual/ndvi_2021.js';
import { map_ndvi_2022 } from '../js_ndvi_anual/ndvi_2022.js';
import { map_ndvi_2023 } from '../js_ndvi_anual/ndvi_2023.js';
import { map_ndvi_2024 } from '../js_ndvi_anual/ndvi_2024.js';

const ndviLoaders = [
    map_ndvi_2017,
    map_ndvi_2018,
    map_ndvi_2019,
    map_ndvi_2020,
    map_ndvi_2021,
    map_ndvi_2022,
    map_ndvi_2023,
    map_ndvi_2024
];

export async function loadNdviLayersyear(map) {
    const years = [2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024];
    const ndviLayers = {};
    const georasters = {};

    try {
        const layersData = await Promise.all(ndviLoaders.map(loader => loader(map)));
        layersData.forEach((data, index) => {
            const year = years[index];
            ndviLayers[`NDVI ${year}`] = data.layer;
            georasters[`NDVI ${year}`] = data.georaster;
        });
    } catch (error) {
        console.error("Error loading NDVI layers:", error);
    }
    return { layers: ndviLayers, georasters: georasters };
}
