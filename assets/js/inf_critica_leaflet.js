const CATEGORY_COLORS = {
    "EDUCACION":        "#3b82f6",
    "SALUD":            "#ef4444",
    "CENTRO DEPORTIVO": "#22c55e",
    "OTROS":            "#94a3b8",
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
                        radius: 5,
                        fillColor: color,
                        color: "#fff",
                        weight: 1.5,
                        opacity: 0.9,
                        fillOpacity: 0.75,
                    }),
                onEachFeature: (feature, layer) => {
                    const p = feature.properties;
                    layer.bindTooltip(`
                        <strong>${p.CATEGORIA || ''}</strong><br>
                        ${p.SUBCATEGOR || ''}<br>
                        <em>${p.NOM_RBD || ''}</em>
                    `, { direction: 'top', offset: [0, -6] });
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
