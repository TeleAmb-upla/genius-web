// Función para normalizar las subcategorías
const normalizeSubcategory = (str) => str.trim().toLowerCase();

// Mapa de nombres de categorías a nombres amigables
const subcategoryNames = {
    "jardin infantil": "Jardín Infantil",
    "carabineros": "Carabineros",
    "fonasa": "Fonasa",
    "centro de salud": "Centro de Salud",
    "sapu": "SAPU",
    "hospital": "Hospital",
    "posta": "Posta",
    "estadio": "Estadio",
    "gimnasio municipal": "Gimnasio Municipal",
    "piscina municipal": "Piscina Municipal",
    "autodromo": "Autódromo",
    "cancha": "Cancha",
    "multicancha": "Multicancha",
    "gobernacion provincial": "Gobernación Provincial",
    "policia de investigaciones": "Policía de Investigaciones",
    "tesoreria general de la republica": "Tesorería General de la República",
    "escuela": "Escuela",
    "colegio": "Colegio",
    "escuela de parvulo": "Escuela de Parvulo",
    "liceo": "Liceo",
    "juzgado de policia local": "Juzgado de Policía Local",
    "municipalidad": "Municipalidad",
    "clinica": "Clínica",
    "laboratorio clinico": "Laboratorio Clínico",
    "policlinico": "Policlínico"
};

/*
const categoriaszom = {
    "EDUCACION"          
    "SALUD":                
    "OTROS":               
    "CENTRO DEPORTIVO":   }
    */
const educacion = '/assets/img/iconos_infraestructura/school.svg';
const policia = '/assets/img/iconos_infraestructura/police.svg';
const piscina = '/assets/img/iconos_infraestructura/pool.svg';
const juez = '/assets/img/iconos_infraestructura/juez.svg';
const hospital= '/assets/img/iconos_infraestructura/hospital.svg';
const clinico= '/assets/img/iconos_infraestructura/clinico.svg';
const auto = '/assets/img/iconos_infraestructura/autodromo.svg';
const tesoreria = '/assets/img/iconos_infraestructura/tesoreria.svg';
const deporte = '/assets/img/iconos_infraestructura/deporte.svg';
const corporacion = '/assets/img/iconos_infraestructura/corporacion.svg';
const locationIcon = '/assets/img/iconos_infraestructura/location.svg';
// Define íconos específicos para las subcategorías
const subcategoryIcons = {
    "jardin infantil": L.icon({
        iconUrl: educacion,
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "carabineros": L.icon({
        iconUrl: policia,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "fonasa": L.icon({
        iconUrl: corporacion,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "centro de salud": L.icon({
        iconUrl: hospital,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "sapu": L.icon({
        iconUrl: hospital,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "hospital": L.icon({
        iconUrl: hospital,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "posta": L.icon({
        iconUrl: hospital,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "estadio": L.icon({
        iconUrl: deporte,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "gimnasio municipal": L.icon({
        iconUrl: deporte,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "piscina municipal": L.icon({
        iconUrl: piscina,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "autodromo": L.icon({
        iconUrl: auto,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "cancha": L.icon({
        iconUrl: deporte,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "multicancha": L.icon({
        iconUrl: deporte,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "gobernacion provincial": L.icon({
        iconUrl: deporte,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "policia de investigaciones": L.icon({
        iconUrl: deporte,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "tesoreria general de la republica": L.icon({
        iconUrl:tesoreria,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "escuela": L.icon({
        iconUrl:educacion,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "colegio": L.icon({
        iconUrl: educacion,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "escuela de parvulo": L.icon({
        iconUrl: educacion,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "liceo": L.icon({
        iconUrl: educacion,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "juzgado de policia local": L.icon({
        iconUrl: juez,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "municipalidad": L.icon({
        iconUrl: corporacion,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "clinica": L.icon({
        iconUrl: clinico,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "laboratorio clinico": L.icon({
        iconUrl: clinico,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    }),
    "policlinico": L.icon({
        iconUrl: clinico,
       
        iconSize: [38, 95],
        shadowSize: [50, 64],
        iconAnchor: [22, 94],
        shadowAnchor: [4, 62],
        popupAnchor: [-3, -76]
    })
};


// Función para cargar datos GeoJSON y configurar capas
export async function loadinf_critica(currentMap) {
  try {
    const response = await fetch('/assets/vec/capas/intraestructura_critica.geojson');
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Obtener categorías únicas y normalizadas
    const categories = new Set();
    data.features.forEach(feature => {
      if (feature.properties.SUBCATEGOR) {
        categories.add(normalizeSubcategory(feature.properties.SUBCATEGOR));
      }
    });

    // Crear un objeto para almacenar las capas
    const categoryLayers = {};

    // Crear una capa para cada categoría y añadirla al mapa
    categories.forEach(category => {
      const layerName = subcategoryNames[category] || category;

      // Filtrar las características para esta categoría
      const categoryFeatures = data.features.filter(feature => normalizeSubcategory(feature.properties.SUBCATEGOR) === category);

      const layer = L.geoJSON(categoryFeatures, {
        pointToLayer: function (feature, latlng) {
          const subcategory = normalizeSubcategory(feature.properties.SUBCATEGOR);
          const icon = subcategoryIcons[subcategory] || new L.Icon.Default();
          return L.marker(latlng, { icon: icon });
        },
        onEachFeature: function (feature, layer) {
          // Crear un tooltip para cada marcador
          const properties = feature.properties;

          const tooltipContent = `
            <strong>Categoría:</strong> ${properties.CATEGORIA}<br>
            <strong>Sub-Categoría:</strong> ${properties.SUBCATEGOR}<br>
            <strong>Nombre:</strong> ${properties.NOM_RBD}
          `;
          layer.bindTooltip(tooltipContent);
        }
      });

      // Añadir la capa al mapa directamente
     // layer.addTo(currentMap);

      // Añadir la capa al objeto de capas
      categoryLayers[layerName] = layer;
    });

    // Devolver las capas si necesitas usarlas más tarde
    return categoryLayers;

  } catch (error) {
    console.error("Error al cargar el GeoJSON:", error);
  }
}
