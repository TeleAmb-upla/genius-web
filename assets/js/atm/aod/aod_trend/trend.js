import { geniusTitleForProduct } from '../../../map_data_catalog.js';
import {
    trendLegendSpec,
    trendColorFromValue,
    trendRasterLegendSvgInner,
} from '../../../trend_scale.js';
import { physicalAodTrend } from '../../../raster_quantized_decode.js';

function valueToSTColor(value) {
    const valueP = physicalAodTrend(value);
    if (Number.isNaN(valueP)) return null;
    const spec = trendLegendSpec('aod', 'raster');
    if (!spec) return null;
    return trendColorFromValue(valueP, spec);
}

export async function map_trend(map) {
    try {
        const response = await fetch(
            resolveAssetUrl('assets/data/raster/AOD/AOD_Trend/AOD_Yearly_Trend.tif'),
        );
        const arrayBuffer = await response.arrayBuffer();

        const georaster = await parseGeoraster(arrayBuffer);

        const Layer = new GeoRasterLayer({
            georaster: georaster,
            pixelValuesToColorFn: values => {
                return valueToSTColor(values[0]);
            },
            resolution: 384,
        });

        return {
            layer: Layer,
            georaster: georaster,
        };
    } catch (error) {
        console.error('Error al cargar el georaster de tendencia:', error);
        return null;
    }
}

export function createSTLegendSVG() {
    const spec = trendLegendSpec('aod', 'raster');
    const heading = geniusTitleForProduct('Tendencia AOD', 'aod');
    if (!spec) {
        return `<svg class="map-legend-svg" width="165" height="80" xmlns="http://www.w3.org/2000/svg"><text x="5" y="20" font-size="14" font-family="Arial" font-weight="bold">${heading}</text></svg>`;
    }
    const steps = 9;
    const { legendItems, valueLabels, totalHeight } = trendRasterLegendSvgInner(
        spec,
        steps,
        2,
    );
    return `
        <svg class="map-legend-svg" width="165" height="${totalHeight + 80}" xmlns="http://www.w3.org/2000/svg">
            <text x="5" y="20" font-size="14" font-family="Arial" font-weight="bold">${heading}</text>
            ${legendItems}
            ${valueLabels}
        </svg>
    `;
}
