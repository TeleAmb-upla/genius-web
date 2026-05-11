import { geniusYearSpanSuffix } from '../../../map_data_catalog.js';
import {
    trendLegendSpec,
    trendColorFromValue,
    trendRasterLegendSvgInner,
} from '../../../trend_scale.js';
import { physicalNo2Trend } from '../../../raster_quantized_decode.js';

function valueToSTColor(value) {
    const v = physicalNo2Trend(value);
    if (Number.isNaN(v)) return null;
    const spec = trendLegendSpec('no2', 'raster');
    if (!spec) return null;
    return trendColorFromValue(v, spec);
}

export async function map_trend(map) {
    try {
        const response = await fetch(
            resolveAssetUrl('assets/data/raster/NO2/NO2_Trend/NO2_Yearly_Trend.tif'),
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
    const spec = trendLegendSpec('no2', 'raster');
    const title = `NO<tspan baseline-shift="sub">2</tspan> — Tendencia${geniusYearSpanSuffix('no2')}`;
    if (!spec) {
        return `<svg class="map-legend-svg" width="190" height="80" xmlns="http://www.w3.org/2000/svg"><text x="0" y="22" font-size="12" font-family="Arial" font-weight="bold">${title}</text></svg>`;
    }
    const steps = 9;
    const { legendItems, valueLabels, totalHeight } = trendRasterLegendSvgInner(
        spec,
        steps,
        2,
    );
    return `
        <svg class="map-legend-svg" width="190" height="${totalHeight + 80}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="22" font-size="12" font-family="Arial" font-weight="bold">${title}</text>
            ${legendItems}
            ${valueLabels}
        </svg>
    `;
}
