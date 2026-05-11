/**
 * Años por producto y título de iluminación: generados por el pipeline
 * (`python -m scripts.gee.lib.genius_frontend_catalog` tras sync / `python -m scripts.repo.rasters.convert_illumination`).
 * Incluye `ndvi_raster` (años con `NDVI_Yearly_*.tif` en repo) para el mapa píxel.
 */
import {
    GENIUS_ILLUMINATION_MAP_TITLE,
    PRODUCT_YEARS,
} from "./genius_map_catalog.generated.js";

export { GENIUS_ILLUMINATION_MAP_TITLE, PRODUCT_YEARS };

export const MONTH_CODES = Array.from({ length: 12 }, (_, index) =>
    String(index + 1).padStart(2, "0")
);

export function getProductYears(productKey) {
    return [...(PRODUCT_YEARS[productKey] || [])];
}

/**
 * Rango de años para textos (en-dash tipográfico).
 * @param {number|string} y0
 * @param {number|string} y1
 */
export function formatGeniusYearSpan(y0, y1) {
    const a = Number(y0);
    const b = Number(y1);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return "";
    if (a === b) return String(a);
    return `${a} – ${b}`;
}

/**
 * Sufijo " (aaaa – bbbb)" para concatenar a un título, o cadena vacía.
 * @param {keyof typeof PRODUCT_YEARS} productKey
 */
export function geniusYearSpanSuffix(productKey) {
    const years = getProductYears(productKey);
    if (!years.length) return "";
    const span = formatGeniusYearSpan(years[0], years[years.length - 1]);
    return span ? ` (${span})` : "";
}

/**
 * Título de gráfico/mapa con rango de años del producto.
 * @param {string} baseTitle
 * @param {keyof typeof PRODUCT_YEARS} productKey
 */
export function geniusTitleForProduct(baseTitle, productKey) {
    return `${baseTitle}${geniusYearSpanSuffix(productKey)}`;
}

/* —— Escala temporal en título del mapa (index2: Anual / Mensual / Tendencia) —— */

const GENIUS_TEMPORAL_MODE_LABELS = Object.freeze({
    yearly: "Anual",
    monthly: "Mensual",
    trend: "Tendencia",
});

let _explorerTemporalModeKey = "yearly";

function geniusExplorerTemporalSuffixEnabled() {
    try {
        return (
            typeof document !== "undefined" &&
            document.body &&
            document.body.classList.contains("genius-explorer")
        );
    } catch (_e) {
        return false;
    }
}

/**
 * Llama LayersControl al cambiar modo; actualiza títulos con data-genius-temporal-title.
 * @param {"yearly"|"monthly"|"trend"} key
 */
export function setGeniusExplorerTemporalMode(key) {
    if (!Object.prototype.hasOwnProperty.call(GENIUS_TEMPORAL_MODE_LABELS, key)) {
        return;
    }
    _explorerTemporalModeKey = key;
    refreshGeniusMountedMapTitles();
}

export function getGeniusExplorerTemporalMode() {
    return _explorerTemporalModeKey;
}

export function geniusTemporalScaleSuffix() {
    if (!geniusExplorerTemporalSuffixEnabled()) return "";
    const lab = GENIUS_TEMPORAL_MODE_LABELS[_explorerTemporalModeKey];
    return lab ? ` · ${lab}` : "";
}

export function geniusMapTitleWithTemporal(baseTitlePlain) {
    return `${baseTitlePlain}${geniusTemporalScaleSuffix()}`;
}

/** Reaplica Anual/Mensual/Tendencia a títulos registrados con data-genius-temporal-title. */
export function refreshGeniusMountedMapTitles() {
    if (typeof document === "undefined") return;
    document.querySelectorAll('[data-genius-temporal-title="1"]').forEach((el) => {
        const base = el.getAttribute("data-genius-title-base") || "";
        const full = geniusMapTitleWithTemporal(base);
        el.innerHTML = `<strong>${full}</strong>`;
    });
}

/**
 * @param {HTMLElement | null} el
 * @param {string} baseTitlePlain
 * @param {{ temporalTitle?: boolean }} [options]
 */
export function mountGeniusMapTitleElement(el, baseTitlePlain, options = {}) {
    if (!el || baseTitlePlain === undefined || baseTitlePlain === null) return;
    const base = String(baseTitlePlain);
    const temporalTitle = Boolean(options.temporalTitle);
    el.setAttribute("data-genius-title-base", base);
    if (temporalTitle) {
        el.setAttribute("data-genius-temporal-title", "1");
    } else {
        el.removeAttribute("data-genius-temporal-title");
    }
    const full = temporalTitle ? geniusMapTitleWithTemporal(base) : base;
    el.innerHTML = `<strong>${full}</strong>`;
}

/**
 * En index2 (`body.genius-explorer`): envuelve el contenedor Leaflet en `.genius-map-stage` y coloca
 * el título como hermano del mapa (misma estructura que los comparadores MapLibre / GeoJSON).
 * Fuera del explorador: el título sigue dentro del `.leaflet-container` con `id="map-title"`.
 * @param {{ getContainer: () => HTMLElement | null }} map
 * @param {string} titleText
 * @param {{ temporalTitle?: boolean }} [options]
 */
export function mountGeniusLeafletMapTitle(map, titleText, options = {}) {
    if (!map || typeof map.getContainer !== "function" || titleText === undefined || titleText === null) {
        return;
    }
    const base = String(titleText);
    const mapRoot = map.getContainer();
    if (!mapRoot) return;

    const useExplorerStage =
        typeof document !== "undefined" &&
        document.body &&
        document.body.classList.contains("genius-explorer");

    if (useExplorerStage) {
        let stage = mapRoot.parentElement;
        if (!stage || !stage.classList.contains("genius-map-stage")) {
            const parent = mapRoot.parentNode;
            if (!parent) return;
            stage = document.createElement("div");
            stage.className = "genius-map-stage";
            stage.style.cssText =
                "position:relative;width:100%;height:100%;min-height:100%;min-width:0;";
            parent.insertBefore(stage, mapRoot);
            stage.appendChild(mapRoot);
        }
        let titleEl = stage.querySelector(":scope > .map-title");
        if (!titleEl) {
            titleEl = document.createElement("div");
            titleEl.id = "title";
            titleEl.className = "map-title";
            stage.appendChild(titleEl);
        }
        mountGeniusMapTitleElement(titleEl, base, options);
        return;
    }

    let mapTitleDiv = document.getElementById("map-title");
    if (!mapTitleDiv) {
        mapTitleDiv = document.createElement("div");
        mapTitleDiv.id = "map-title";
        mapTitleDiv.className = "map-title";
        mapRoot.appendChild(mapTitleDiv);
    }
    mountGeniusMapTitleElement(mapTitleDiv, base, options);
}

/**
 * Quita el título montado por `mountGeniusLeafletMapTitle` (explorador: hermano en `.genius-map-stage`;
 * legado: `#map-title` dentro del contenedor Leaflet).
 * @param {{ getContainer: () => HTMLElement | null }} map
 */
export function removeGeniusLeafletMapTitle(map) {
    if (!map || typeof map.getContainer !== "function") return;
    const mapRoot = map.getContainer();
    if (!mapRoot) return;
    const stage = mapRoot.closest?.(".genius-map-stage");
    const el =
        (stage && stage.querySelector(":scope > .map-title")) || document.getElementById("map-title");
    el?.remove();
}

/** Etiqueta corta "aaaa – bbbb" (leyendas que ya no duplican el rango en subtítulo). */
export function getProductYearRangeLabel(productKey) {
    const years = getProductYears(productKey);
    if (!years.length) return "";
    return formatGeniusYearSpan(years[0], years[years.length - 1]);
}

export function getDefaultYearPair(productKey) {
    const years = getProductYears(productKey);
    if (!years.length) return [null, null];
    const last = years[years.length - 1];
    const secondToLast = years.length > 1 ? years[years.length - 2] : last;
    return [String(secondToLast), String(last)];
}

export function getDefaultMonthPair() {
    return [MONTH_CODES[0], MONTH_CODES[MONTH_CODES.length - 1]];
}

export function populateYearSelector(selectElement, productKey) {
    selectElement.innerHTML = "";
    getProductYears(productKey).forEach((year) => {
        const option = document.createElement("option");
        option.value = String(year);
        option.textContent = String(year);
        selectElement.appendChild(option);
    });
}

export function populateMonthSelector(selectElement) {
    selectElement.innerHTML = "";
    MONTH_CODES.forEach((month) => {
        const option = document.createElement("option");
        option.value = month;
        option.textContent = month;
        selectElement.appendChild(option);
    });
}
