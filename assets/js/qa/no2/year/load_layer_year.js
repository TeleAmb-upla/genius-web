
import { map_2019 } from './js_anual/year_2019.js';
import { map_2020 } from './js_anual/year_2020.js';
import { map_2021 } from './js_anual/year_2021.js';
import { map_2022 } from './js_anual/year_2022.js';
import { map_2023 } from './js_anual/year_2023.js';
import { map_2024 } from './js_anual/year_2024.js';

const Loaders = [
    map_2019,
    map_2020,
    map_2021,
    map_2022,
    map_2023,
    map_2024
];


export async function loadLayersyear(map) {
    const years = [
        2019, 2020, 2021, 2022, 2023, 2024
    ];
  
    const Layers = {};
    const georasters = {};
    try {
        const layersData = await Promise.all(Loaders.map(loader => loader(map)));
        layersData.forEach((data, index) => {
            const year = years[index];
            Layers[`NO² ${year}`] = data.layer;
            georasters[`NO² ${year}`] = data.georaster;
        });
    } catch (error) {
        console.error("Error loading layers:", error);
    }
    return { layers: Layers, georasters: georasters };
}
