// loadLayersmonth.js

import { map_st_01 } from './js_st_month/month_01.js';
import { map_st_02 } from './js_st_month/month_02.js';
import { map_st_03 } from './js_st_month/month_03.js';
import { map_st_04 } from './js_st_month/month_04.js';
import { map_st_05 } from './js_st_month/month_05.js';
import { map_st_06 } from './js_st_month/month_06.js';
import { map_st_07 } from './js_st_month/month_07.js';
import { map_st_08 } from './js_st_month/month_08.js';
import { map_st_09 } from './js_st_month/month_09.js';
import { map_st_10 } from './js_st_month/month_10.js';
import { map_st_11 } from './js_st_month/month_11.js';
import { map_st_12 } from './js_st_month/month_12.js';

const Loadersmonth = {
    '01': map_st_01,
    '02': map_st_02,
    '03': map_st_03,
    '04': map_st_04,
    '05': map_st_05,
    '06': map_st_06,
    '07': map_st_07,
    '08': map_st_08,
    '09': map_st_09,
    '10': map_st_10,
    '11': map_st_11,
    '12': map_st_12,
};

export async function loadLayersmonth(map) {
    const Layers = {};
    const georasters = {};
    try {
        const months = Object.keys(Loadersmonth);
        const layersData = await Promise.all(months.map(month => Loadersmonth[month](map)));
        layersData.forEach((data, index) => {
            const month = months[index];
            Layers[`AOD ${month}`] = data.layer;
            georasters[`AOD ${month}`] = data.georaster;
        });
    } catch (error) {
        console.error("Error loading layers:", error);
    }
    return { layers: Layers, georasters: georasters };
}
