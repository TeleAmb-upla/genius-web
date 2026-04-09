const CATEGORY_COLORS = {
    "EDUCACION":            "#3b82f6",
    "SALUD":                "#ef4444",
    "CENTRO DEPORTIVO":     "#22c55e",
    "SEGURIDAD":            "#f59e0b",
    "GOBIERNO":             "#8b5cf6",
    "JUSTICIA":             "#ec4899",
    "EMERGENCIA":           "#f97316",
    "CORPORACION":          "#06b6d4",
    "OTROS":                "#94a3b8",
};

const DEFAULT_COLOR = "#94a3b8";

function getCategoryColor(cat) {
    if (!cat) return DEFAULT_COLOR;
    return CATEGORY_COLORS[cat.toUpperCase().trim()] || DEFAULT_COLOR;
}

export async function loadinf_critica(currentMap) {
    try {
        const response = await fetch(resolveAssetUrl('assets/data/vectores/intraestructura_critica.geojson'));
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();

        const categoryGroups = {};

        data.features.forEach(feature => {
            const cat = (feature.properties.CATEGORIA || "OTROS").toUpperCase().trim();
            if (!categoryGroups[cat]) categoryGroups[cat] = [];
            categoryGroups[cat].push(feature);
        });

        const categoryLayers = {};

        Object.entries(categoryGroups).forEach(([cat, features]) => {
            const color = getCategoryColor(cat);
            const layer = L.geoJSON(features, {
                pointToLayer: (feature, latlng) =>
                    L.circleMarker(latlng, {
                        radius: 8,
                        fillColor: color,
                        color: "#333",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.85,
                    }),
                onEachFeature: (feature, layer) => {
                    const p = feature.properties;
                    layer.bindTooltip(`
                        <strong>${p.CATEGORIA || ''}</strong><br>
                        ${p.SUBCATEGOR || ''}<br>
                        <em>${p.NOM_RBD || ''}</em>
                    `, { direction: 'top', offset: [0, -8] });
                },
            });
            const label = cat.charAt(0) + cat.slice(1).toLowerCase();
            categoryLayers[label] = layer;
        });

        return categoryLayers;
    } catch (error) {
        console.error("Error al cargar el GeoJSON:", error);
        return null;
    }
}
