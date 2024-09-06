import { map_2001 } from './js_anual/year_2001.js';
import { map_2002 } from './js_anual/year_2002.js';
import { map_2003 } from './js_anual/year_2003.js';
import { map_2004 } from './js_anual/year_2004.js';
import { map_2005 } from './js_anual/year_2005.js';
import { map_2006 } from './js_anual/year_2006.js';
import { map_2007 } from './js_anual/year_2007.js';
import { map_2008 } from './js_anual/year_2008.js';
import { map_2009 } from './js_anual/year_2009.js';
import { map_2010 } from './js_anual/year_2010.js';
import { map_2011 } from './js_anual/year_2011.js';
import { map_2012 } from './js_anual/year_2012.js';
import { map_2013 } from './js_anual/year_2013.js';
import { map_2014 } from './js_anual/year_2014.js';
import { map_2015 } from './js_anual/year_2015.js';
import { map_2016 } from './js_anual/year_2016.js';
import { map_2017 } from './js_anual/year_2017.js';
import { map_2018 } from './js_anual/year_2018.js';
import { map_2019 } from './js_anual/year_2019.js';
import { map_2020 } from './js_anual/year_2020.js';
import { map_2021 } from './js_anual/year_2021.js';
import { map_2022 } from './js_anual/year_2022.js';
import { map_2023 } from './js_anual/year_2023.js';

const Loaders = [
    map_2001,
    map_2002,
    map_2003,
    map_2004,
    map_2005,
    map_2006,
    map_2007,
    map_2008,
    map_2009,
    map_2010,
    map_2011,
    map_2012,
    map_2013,
    map_2014,
    map_2015,
    map_2016,
    map_2017,
    map_2018,
    map_2019,
    map_2020,
    map_2021,
    map_2022,
    map_2023
];


export async function loadLayersyear(map) {
    const years = [
        2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009, 
        2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 
        2019, 2020, 2021, 2022, 2023
    ];
  
    const Layers = {};
    try {
        const layers = await Promise.all(Loaders.map(loader => loader(map)));
        layers.forEach((layer, index) => {
            const year = years[index];
            Layers[`AOD ${year}`] = layer;
        });
    } catch (error) {
        console.error("Error loading  layers:", error);
    }
    return Layers;
}
