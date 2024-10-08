import { map_ndvi_01 } from '../js_ndvi_month/ndvi_01.js'; 
import { map_ndvi_02 } from '../js_ndvi_month/ndvi_02.js';
import { map_ndvi_03 } from '../js_ndvi_month/ndvi_03.js';
import { map_ndvi_04 } from '../js_ndvi_month/ndvi_04.js';
import { map_ndvi_05 } from '../js_ndvi_month/ndvi_05.js';
import { map_ndvi_06 } from '../js_ndvi_month/ndvi_06.js';
import { map_ndvi_07 } from '../js_ndvi_month/ndvi_07.js';
import { map_ndvi_08 } from '../js_ndvi_month/ndvi_08.js';
import { map_ndvi_09 } from '../js_ndvi_month/ndvi_09.js';
import { map_ndvi_10 } from '../js_ndvi_month/ndvi_10.js';
import { map_ndvi_11 } from '../js_ndvi_month/ndvi_11.js';
import { map_ndvi_12 } from '../js_ndvi_month/ndvi_12.js';

const ndviLoadersmonth = {
    '01': map_ndvi_01,
    '02': map_ndvi_02,
    '03': map_ndvi_03,
    '04': map_ndvi_04,
    '05': map_ndvi_05,
    '06': map_ndvi_06,
    '07': map_ndvi_07,
    '08': map_ndvi_08,
    '09': map_ndvi_09,
    '10': map_ndvi_10,
    '11': map_ndvi_11,
    '12': map_ndvi_12,
};

export async function loadNdviLayersmonth(map) {
    const ndviLayers = {};
    const georasters = {};
    try {
        const months = Object.keys(ndviLoadersmonth);
        const layersData = await Promise.all(months.map(month => ndviLoadersmonth[month](map)));
        layersData.forEach((data, index) => {
            const month = months[index];
            ndviLayers[`NDVI ${month}`] = data.layer;
            georasters[`NDVI ${month}`] = data.georaster;
        });
    } catch (error) {
        console.error("Error loading NDVI layers:", error);
    }
    return { layers: ndviLayers, georasters: georasters };
}
