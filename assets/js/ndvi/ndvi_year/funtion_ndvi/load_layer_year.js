import { getProductYears } from "../../../map_data_catalog.js";
import { loadNdviYearlyPixelLayer } from "../load_ndvi_yearly_pixel.js";

export async function loadNdviLayersyear(map) {
    const years = getProductYears("ndvi_raster");
    const ndviLayers = {};
    const georasters = {};

    const settled = await Promise.allSettled(
        years.map((year) => loadNdviYearlyPixelLayer(map, year)),
    );
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
