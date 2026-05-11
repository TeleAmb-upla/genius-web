import { ndviToColor } from "./ndvi_palette.js";
import { fetchGeoTiffTryPaths } from "../../raster_fetch.js";
import { candidatePathsNdviYearly } from "../ndvi_raster_paths.js";

/** Composito anual NDVI píxel: ``NDVI_Yearly/NDVI_Yearly_YYYY.tif``. */
export async function loadNdviYearlyPixelLayer(map, year) {
    void map;
    const y = Number(year);
    const arrayBuffer = await fetchGeoTiffTryPaths(candidatePathsNdviYearly(y));
    if (!arrayBuffer) {
        return { layer: null, georaster: null };
    }

    const georaster = await parseGeoraster(arrayBuffer);
    const ndviLayer = new GeoRasterLayer({
        georaster,
        opacity: 0.7,
        pixelValuesToColorFn: (values) => {
            const ndviValue = values[0];
            if (isNaN(ndviValue)) {
                return null;
            }
            return ndviToColor(ndviValue);
        },
        resolution: 384,
    });

    return { layer: ndviLayer, georaster };
}
