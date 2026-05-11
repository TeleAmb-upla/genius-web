import { geniusTitleForProduct } from "../../map_data_catalog.js";
import { ndviStdDevLegendDomain } from "../../legend_ranges.js";
import { fetchGeoTiffTryPaths } from "../../raster_fetch.js";
import {
    candidatePathsNdviMonthlyStdDev,
    getNdviMonthlyStdDevWindowYears,
} from "../ndvi_raster_paths.js";
import {
    NDVI_STDEV_COLOR_RANGE,
    ndviStdDevRawToColor,
} from "../ndvi_stdev_color.js";

export async function map_stdev(map) {
    void map;
    try {
        const arrayBuffer = await fetchGeoTiffTryPaths(
            candidatePathsNdviMonthlyStdDev(),
        );
        if (!arrayBuffer) {
            console.warn(
                "[NDVI DE] No se encontró GeoTIFF de desviación estándar en las rutas candidatas.",
            );
            return null;
        }

        const georaster = await parseGeoraster(arrayBuffer);

        const Layer = new GeoRasterLayer({
            georaster,
            pixelValuesToColorFn: (values) => ndviStdDevRawToColor(values[0]),
            resolution: 384,
        });

        return {
            layer: Layer,
            georaster,
        };
    } catch (error) {
        console.error("Error al cargar el georaster de desviación estándar:", error);
        return null;
    }
}

export function createDevLegendSVG() {
    const domain = ndviStdDevLegendDomain();
    const colors = NDVI_STDEV_COLOR_RANGE;
    const w = (domain[1] - domain[0]) / colors.length;
    const { y0, y1 } = getNdviMonthlyStdDevWindowYears();

    const legendItems = colors
        .map((color, index) => {
            const yStart = domain[0] + index * w;
            const yEnd = domain[0] + (index + 1) * w;
            const label = `${yStart.toFixed(2)} – ${yEnd.toFixed(2)}`;
            const yPosition = 58 + index * 28;
            return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>`;
        })
        .join("");

    const calculatedHeight = 52 + colors.length * 28 + 8;
    const heading = geniusTitleForProduct("Variabilidad NDVI (DE)", "ndvi");
    const windowNote = `Raster: ventana ${y0}–${y1} (último mes cerrado UTC; ver pipeline)`;

    return `
        <svg class="map-legend-svg" width="200" height="${calculatedHeight}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="13" font-family="Arial" font-weight="bold">${heading}</text>
            <text x="0" y="32" font-size="11" font-family="Arial">Desviación estándar del NDVI</text>
            <text x="0" y="46" font-size="10" font-family="Arial" fill="#444">${windowNote}</text>
            ${legendItems}
        </svg>
    `;
}

export { ndviStdDevRawToColor, NDVI_STDEV_COLOR_RANGE };
