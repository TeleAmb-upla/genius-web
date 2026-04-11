const SUBCATEGORY_ICONS = {
    "jardin infantil":                      "school",
    "carabineros":                          "police",
    "fonasa":                               "corporacion",
    "centro de salud":                      "hospital",
    "sapu":                                 "hospital",
    "hospital":                             "hospital",
    "posta":                                "hospital",
    "estadio":                              "deporte",
    "gimnasio municipal":                   "deporte",
    "piscina municipal":                    "pool",
    "autodromo":                            "autodromo",
    "cancha":                               "deporte",
    "multicancha":                          "deporte",
    "gobernacion provincial":               "corporacion",
    "policia de investigaciones":           "police",
    "tesoreria general de la republica":    "tesoreria",
    "escuela":                              "school",
    "colegio":                              "school",
    "escuela de parvulo":                   "school",
    "liceo":                                "school",
    "juzgado de policia local":             "juez",
    "municipalidad":                        "muni",
    "clinica":                              "clinico",
    "laboratorio clinico":                  "clinico",
    "policlinico":                          "clinico",
};

const ICON_BASE = 'assets/img/iconos_infraestructura/';

function getSubcategoryIcon(subcat) {
    const key = (subcat || '').trim().toLowerCase();
    const name = SUBCATEGORY_ICONS[key] || 'emergencia';
    return L.icon({
        iconUrl: resolveAssetUrl(`${ICON_BASE}${name}.svg`),
        iconSize: [24, 24],
        iconAnchor: [12, 12],
        popupAnchor: [0, -12],
        tooltipAnchor: [0, -12],
    });
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
            const layer = L.geoJSON(features, {
                pointToLayer: (feature, latlng) =>
                    L.marker(latlng, {
                        icon: getSubcategoryIcon(feature.properties.SUBCATEGOR),
                    }),
                onEachFeature: (feature, layer) => {
                    const p = feature.properties;
                    layer.bindTooltip(`
                        <strong>${p.CATEGORIA || ''}</strong><br>
                        ${p.SUBCATEGOR || ''}<br>
                        <em>${p.NOM_RBD || ''}</em>
                    `, { direction: 'top', offset: [0, -14] });
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
