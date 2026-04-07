import { map_01 } from './js_month/month_01.js';
import { map_02 } from './js_month/month_02.js';
import { map_03 } from './js_month/month_03.js';
import { map_04 } from './js_month/month_04.js'; 
import { map_05 } from './js_month/month_05.js';
import { map_06 } from './js_month/month_06.js';
import { map_07 } from './js_month/month_07.js';
import { map_08 } from './js_month/month_08.js';
import { map_09 } from './js_month/month_09.js';
import { map_10 } from './js_month/month_10.js';
import { map_11 } from './js_month/month_11.js';
import { map_12 } from './js_month/month_12.js';

const Loadersmonth = {  
    '01': map_01,
    '02': map_02,
    '03': map_03,
    '04': map_04,
    '05': map_05,
    '06': map_06,
    '07': map_07,
    '08': map_08,
    '09': map_09,
    '10': map_10,
    '11': map_11,
    '12': map_12,
};


export async function loadLayersmonth(map) {
    const Layers = {};
    const georasters = {};
    try {
        const months = Object.keys(Loadersmonth);
        const layersData = await Promise.all(months.map(month => Loadersmonth[month](map)));
        layersData.forEach((data, index) => {
            const month = months[index];
            Layers[`SO² ${month}`] = data.layer;
            georasters[`SO² ${month}`] = data.georaster;
        });
    } catch (error) {
        console.error("Error loading layers:", error);
    }
    return { layers: Layers, georasters: georasters };
}
