/**
 * Registra solo mapas / gráficos en window. Separado de text.js para que un fallo
 * en la cadena de descargas/textos no deje index2 sin map_ndvi (pantalla azul).
 */
import { map_ndvi } from './ndvi/map_ndvi.js';
import { g_a_ndvi } from './ndvi/g_anual_ndvi.js';
import { g_m_ndvi } from './ndvi/g_mensual_ndvi.js';
import { map_ndvi_zonal_b } from './ndvi/map_ndvi_z_b.js';
import { g_ndvi_a_z_b } from './ndvi/g_ndvi_anual_zonal_barrio.js';
import { g_ndvi_m_z_b } from './ndvi/g_ndvi_mes_zonal_barrio.js';
import { map_ndvi_zonal_m } from './ndvi/map_ndvi_z_m.js';
import { g_ndvi_a_z_m } from './ndvi/g_ndvi_anual_zonal_manzana.js';
import { g_ndvi_m_z_m } from './ndvi/g_ndvi_mes_zonal_manzana.js';
import { map_ndvi_stdev } from './ndvi/map_ndvi_stdev.js';
import { g_a_ndvi_stdev } from './ndvi/g_anual_ndvi_stdev.js';
import { g_m_ndvi_stdev } from './ndvi/g_mensual_ndvi_stdev.js';

import { map_t } from './temp/map_temp.js';
import { g_a_t } from './temp/g_anual_t.js';
import { g_m_t } from './temp/g_mensual_t.js';
import { map_t_zonal_b } from './temp/map_t_z_b.js';
import { g_t_a_z_b } from './temp/g_t_anual_zonal_barrio.js';
import { g_t_m_z_b } from './temp/g_t_mes_zonal_barrio.js';
import { map_t_zonal_m } from './temp/map_t_z_m.js';
import { g_t_a_z_m } from './temp/g_t_anual_zonal_manzana.js';
import { g_t_m_z_m } from './temp/g_t_mes_zonal_manzana.js';
import { map_t_islas } from './temp/map_t_islas.js';
import { g_a_t_islas } from './temp/g_anual_t_islas.js';
import { g_m_t_islas } from './temp/g_mensual_t_islas.js';

import { map_aod_p } from './atm/aod/map_aod_p.js';
import { g_a_aod } from './atm/aod/g_anual_aod.js';
import { g_m_aod } from './atm/aod/g_mensual_aod.js';
import { map_aod_b } from './atm/aod/map_aod_b.js';
import { g_a_aod_b } from './atm/aod/g_anual_aod_b.js';
import { g_m_aod_b } from './atm/aod/g_mensual_aod_b.js';
import { map_aod_m } from './atm/aod/map_aod_m.js';
import { g_a_aod_m } from './atm/aod/g_anual_aod_m.js';
import { g_m_aod_m } from './atm/aod/g_mensual_aod_m.js';

import { map_no2_p } from './atm/no2/map_no2_p.js';
import { g_a_no2 } from './atm/no2/g_anual_no2.js';
import { g_m_no2 } from './atm/no2/g_mensual_no2.js';
import { map_no2_b } from './atm/no2/map_no2_b.js';
import { g_a_no2_b } from './atm/no2/g_anual_no2_b.js';
import { g_m_no2_b } from './atm/no2/g_mensual_no2_b.js';
import { map_no2_m } from './atm/no2/map_no2_m.js';
import { g_a_no2_m } from './atm/no2/g_anual_no2_m.js';
import { g_m_no2_m } from './atm/no2/g_mensual_no2_m.js';

import { map_so2_p } from './atm/so2/map_so2_p.js';
import { g_a_so2 } from './atm/so2/g_anual_so2.js';
import { g_m_so2 } from './atm/so2/g_mensual_so2.js';
import { map_so2_b } from './atm/so2/map_so2_b.js';
import { g_a_so2_b } from './atm/so2/g_anual_so2_b.js';
import { g_m_so2_b } from './atm/so2/g_mensual_so2_b.js';
import { map_so2_m } from './atm/so2/map_so2_m.js';
import { g_a_so2_m } from './atm/so2/g_anual_so2_m.js';
import { g_m_so2_m } from './atm/so2/g_mensual_so2_m.js';

import { map_lum } from './lum/map_lum.js';
import { map_hu } from './hu/map_hu.js';
import { g_a_hu } from './hu/g_anual_hu.js';
import { g_m_hu } from './hu/g_mensual_hu.js';

import { installAtmZonalExplorerHost } from './atm/atm_zonal_explorer.js';

installAtmZonalExplorerHost();

window.map_ndvi = map_ndvi;
window.g_a_ndvi = g_a_ndvi;
window.g_m_ndvi = g_m_ndvi;
window.map_ndvi_zonal_b = map_ndvi_zonal_b;
window.g_ndvi_a_z_b = g_ndvi_a_z_b;
window.g_ndvi_m_z_b = g_ndvi_m_z_b;
window.map_ndvi_zonal_m = map_ndvi_zonal_m;
window.g_ndvi_a_z_m = g_ndvi_a_z_m;
window.g_ndvi_m_z_m = g_ndvi_m_z_m;
window.map_ndvi_stdev = map_ndvi_stdev;
window.g_a_ndvi_stdev = g_a_ndvi_stdev;
window.g_m_ndvi_stdev = g_m_ndvi_stdev;

window.map_t = map_t;
window.g_a_t = g_a_t;
window.g_m_t = g_m_t;
window.map_t_zonal_b = map_t_zonal_b;
window.g_t_a_z_b = g_t_a_z_b;
window.g_t_m_z_b = g_t_m_z_b;
window.map_t_zonal_m = map_t_zonal_m;
window.g_t_a_z_m = g_t_a_z_m;
window.g_t_m_z_m = g_t_m_z_m;
window.map_t_islas = map_t_islas;
window.g_a_t_islas = g_a_t_islas;
window.g_m_t_islas = g_m_t_islas;

window.map_aod_p = map_aod_p;
window.g_a_aod = g_a_aod;
window.g_m_aod = g_m_aod;
window.map_aod_b = map_aod_b;
window.g_a_aod_b = g_a_aod_b;
window.g_m_aod_b = g_m_aod_b;
window.map_aod_m = map_aod_m;
window.g_a_aod_m = g_a_aod_m;
window.g_m_aod_m = g_m_aod_m;

window.map_no2_p = map_no2_p;
window.g_a_no2 = g_a_no2;
window.g_m_no2 = g_m_no2;
window.map_no2_b = map_no2_b;
window.g_a_no2_b = g_a_no2_b;
window.g_m_no2_b = g_m_no2_b;
window.map_no2_m = map_no2_m;
window.g_a_no2_m = g_a_no2_m;
window.g_m_no2_m = g_m_no2_m;

window.map_so2_p = map_so2_p;
window.g_a_so2 = g_a_so2;
window.g_m_so2 = g_m_so2;
window.map_so2_b = map_so2_b;
window.g_a_so2_b = g_a_so2_b;
window.g_m_so2_b = g_m_so2_b;
window.map_so2_m = map_so2_m;
window.g_a_so2_m = g_a_so2_m;
window.g_m_so2_m = g_m_so2_m;

window.map_lum = map_lum;
window.map_hu = map_hu;
window.g_a_hu = g_a_hu;
window.g_m_hu = g_m_hu;
window.dispatchEvent(new Event('genius-explorer-maps-ready'));
