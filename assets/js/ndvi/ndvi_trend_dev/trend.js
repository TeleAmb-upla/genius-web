import { fetchGeoTiffTryPaths } from '../../raster_fetch.js';
import { candidatePathsNdviTrend } from '../ndvi_raster_paths.js';
import { geniusTitleForProduct } from '../../map_data_catalog.js';
import {
    trendLegendSpec,
    trendColorFromValue,
    trendRasterLegendSvgInner,
} from '../../trend_scale.js';
import { physicalNdviTrend } from '../../raster_quantized_decode.js';

function valueToSTColor(value) {
    const valueP = physicalNdviTrend(value);
    if (Number.isNaN(valueP)) return null;
    const spec = trendLegendSpec('ndvi', 'raster');
    if (!spec) return null;
    return trendColorFromValue(valueP, spec);
}

export async function map_trend(map) {
    const arrayBuffer = await fetchGeoTiffTryPaths(candidatePathsNdviTrend());
    if (!arrayBuffer) {
        return null;
    }

    const georaster = await parseGeoraster(arrayBuffer);

    const Layer = new GeoRasterLayer({
        georaster: georaster,
        pixelValuesToColorFn: values => {
            const Value = values[0];
            return valueToSTColor(Value);
        },
        resolution: 384,
    });

    return { layer: Layer, georaster: georaster };
}

export function createSTLegendSVG() {
    const spec = trendLegendSpec('ndvi', 'raster');
    const heading = geniusTitleForProduct('Tendencia NDVI', 'ndvi');
    if (!spec) {
        return `<svg class="map-legend-svg" width="200" height="80" xmlns="http://www.w3.org/2000/svg"><text x="5" y="20" font-size="14" font-family="Arial" font-weight="bold">${heading}</text></svg>`;
    }
    const steps = 9;
    const { legendItems, valueLabels, totalHeight } = trendRasterLegendSvgInner(
        spec,
        steps,
        3,
    );
    return `
        <svg class="map-legend-svg" width="200" height="${totalHeight + 80}" xmlns="http://www.w3.org/2000/svg">
            <text x="5" y="20" font-size="14" font-family="Arial" font-weight="bold">${heading}</text>
            ${legendItems}
            ${valueLabels}
        </svg>
    `;
}
