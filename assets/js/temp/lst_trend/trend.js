import { geniusTitleForProduct } from '../../map_data_catalog.js';
import {
    trendLegendSpec,
    trendColorFromValue,
    trendRasterLegendSvgInner,
} from '../../trend_scale.js';
import { physicalLstTrend } from '../../raster_quantized_decode.js';

function valueToSTColor(value) {
    const v = physicalLstTrend(value);
    if (Number.isNaN(v)) return null;
    const spec = trendLegendSpec('lst', 'raster');
    if (!spec) return null;
    return trendColorFromValue(v, spec);
}

export async function map_trend(map) {
    try {
        const response = await fetch(
            resolveAssetUrl('assets/data/raster/LST/LST_Trend/LST_Yearly_Trend.tif'),
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
    const spec = trendLegendSpec('lst', 'raster');
    const heading = geniusTitleForProduct('Tendencia LST (°C)', 'lst');
    if (!spec) {
        return `<svg class="map-legend-svg" width="165" height="80" xmlns="http://www.w3.org/2000/svg"><text x="5" y="20" font-size="12" font-family="Arial" font-weight="bold">${heading}</text></svg>`;
    }
    const steps = 9;
    const { legendItems, valueLabels, totalHeight } = trendRasterLegendSvgInner(
        spec,
        steps,
        2,
    );
    return `
        <svg class="map-legend-svg" width="165" height="${totalHeight + 80}" xmlns="http://www.w3.org/2000/svg">
            <text x="5" y="20" font-size="12" font-family="Arial" font-weight="bold">${heading}</text>
            ${legendItems}
            ${valueLabels}
        </svg>
    `;
}
