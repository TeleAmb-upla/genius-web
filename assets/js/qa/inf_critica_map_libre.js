// Rutas de los íconos PNG
const educacion = '/assets/img/iconos_infraestructura/school.png';
const policia = '/assets/img/iconos_infraestructura/police.png';
const piscina = '/assets/img/iconos_infraestructura/pool.png';
const juez = '/assets/img/iconos_infraestructura/juez.png';
const hospital = '/assets/img/iconos_infraestructura/hospital.png';
const clinico = '/assets/img/iconos_infraestructura/clinico.png';
const auto = '/assets/img/iconos_infraestructura/autodromo.png';
const tesoreria = '/assets/img/iconos_infraestructura/tesoreria.png';
const deporte = '/assets/img/iconos_infraestructura/deporte.png';
const corporacion = '/assets/img/iconos_infraestructura/corporacion.png';
const locationIcon = '/assets/img/iconos_infraestructura/location.png';


// Función para normalizar las subcategorías
function normalizeSubcategory(str) {
    return str.trim().toLowerCase();
}

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
    "escuela de parvulo": "Escuela de Párvulo",
    "liceo": "Liceo",
    "juzgado de policia local": "Juzgado de Policía Local",
    "municipalidad": "Municipalidad",
    "clinica": "Clínica",
    "laboratorio clinico": "Laboratorio Clínico",
    "policlinico": "Policlínico"
};

// Mapa de íconos específicos para las subcategorías, utilizando tus constantes
const subcategoryIcons = {
    "jardin infantil": educacion,
    "carabineros": policia,
    "fonasa": corporacion,
    "centro de salud": hospital,
    "sapu": hospital,
    "hospital": hospital,
    "posta": hospital,
    "estadio": deporte,
    "gimnasio municipal": deporte,
    "piscina municipal": piscina,
    "autodromo": auto,
    "cancha": deporte,
    "multicancha": deporte,
    "gobernacion provincial": corporacion,
    "policia de investigaciones": policia,
    "tesoreria general de la republica": tesoreria,
    "escuela": educacion,
    "colegio": educacion,
    "escuela de parvulo": educacion,
    "liceo": educacion,
    "juzgado de policia local": juez,
    "municipalidad": corporacion,
    "clinica": clinico,
    "laboratorio clinico": clinico,
    "policlinico": clinico
};

// Función para cargar imágenes en MapLibre
function loadImages(map, callback) {
    const imagesToLoad = {};

    // Crear un objeto con los nombres únicos de las imágenes y sus rutas
    for (const [subcategory, iconPath] of Object.entries(subcategoryIcons)) {
        const iconName = iconPath.split('/').pop().split('.')[0];
        imagesToLoad[iconName] = iconPath;
    }

    const uniqueImages = Object.entries(imagesToLoad);
    let imagesLoaded = 0;

    uniqueImages.forEach(([imageName, imagePath]) => {
        if (!map.hasImage(imageName)) {
            map.loadImage(imagePath, (error, image) => {
                if (error) {
                    console.error(`Error cargando la imagen ${imagePath}:`, error);
                } else {
                    map.addImage(imageName, image);
                }
                imagesLoaded++;
                if (imagesLoaded === uniqueImages.length) {
                    callback();
                }
            });
        } else {
            imagesLoaded++;
            if (imagesLoaded === uniqueImages.length) {
                callback();
            }
        }
    });
}

// Función principal para cargar y mostrar las infraestructuras críticas
export async function loadInfCriticaMapLibre(map) {
    try {
        // Verificar si la fuente ya existe
        if (map.getSource('infraestructuraCritica')) {
            // Mostrar las capas si estaban ocultas
            if (map.getLayer('infra-layer') && map.getLayoutProperty('infra-layer', 'visibility') === 'none') {
                map.setLayoutProperty('infra-layer', 'visibility', 'visible');
            }
            return; // No continuar cargando si ya existe
        }

        // Fetch del archivo GeoJSON
        const response = await fetch('/assets/vec/capas/intraestructura_critica.geojson');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // Normalizar las subcategorías y agregar propiedades para el ícono y su nombre
        data.features.forEach(feature => {
            const subcategory = normalizeSubcategory(feature.properties.SUBCATEGOR);
            feature.properties.normalizedSubcategory = subcategory;

            // Obtener el nombre del ícono a partir de la ruta
            const iconPath = subcategoryIcons[subcategory] || locationIcon; // Ícono por defecto
            const iconName = iconPath.split('/').pop().split('.')[0];
            feature.properties.icon = iconName;
        });

        // Agregar la fuente de datos GeoJSON a MapLibre
        map.addSource('infraestructuraCritica', {
            type: 'geojson',
            data: data
        });

        // Cargar imágenes y luego agregar capas
        loadImages(map, () => {
            addInfraLayers(map);
            setupZoomHandling(map);
        });

    } catch (error) {
        console.error('Error cargando datos:', error);
    }
}

// Función para agregar las capas de infraestructuras al mapa
function addInfraLayers(map) {
    // Agregar una capa de símbolos utilizando los íconos
    map.addLayer({
        id: 'infra-layer',
        type: 'symbol',
        source: 'infraestructuraCritica',
        layout: {
            'icon-image': ['get', 'icon'],
            'icon-size': 0.5,
            'icon-allow-overlap': true
        }
    });

    // Agregar interacción para mostrar popups al hacer clic
    map.on('click', 'infra-layer', (e) => {
        const feature = e.features[0];
        const properties = feature.properties;
        const coordinates = feature.geometry.coordinates.slice();
        const content = `
            <strong>Categoría:</strong> ${properties.CATEGORIA}<br>
            <strong>Sub-Categoría:</strong> ${properties.SUBCATEGOR}<br>
            <strong>Nombre:</strong> ${properties.NOM_RBD}
        `;

        // Asegurarse de que el popup se muestre en la posición correcta
        while (Math.abs(e.lngLat.lng - coordinates[0]) > 180) {
            coordinates[0] += e.lngLat.lng > coordinates[0] ? 360 : -360;
        }

        new maplibregl.Popup()
            .setLngLat(coordinates)
            .setHTML(content)
            .addTo(map);
    });

    // Cambiar el cursor al pasar por un punto
    map.on('mouseenter', 'infra-layer', () => {
        map.getCanvas().style.cursor = 'pointer';
    });
    map.on('mouseleave', 'infra-layer', () => {
        map.getCanvas().style.cursor = '';
    });
}

// Función para manejar la visibilidad de las capas según el nivel de zoom
function setupZoomHandling(map) {
    // Controlar la visibilidad inicial según el nivel de zoom actual
    const initialZoom = map.getZoom();
    if (initialZoom >= 12) {
        if (map.getLayoutProperty('infra-layer', 'visibility') !== 'visible') {
            map.setLayoutProperty('infra-layer', 'visibility', 'visible');
        }
    } else {
        if (map.getLayoutProperty('infra-layer', 'visibility') !== 'none') {
            map.setLayoutProperty('infra-layer', 'visibility', 'none');
        }
    }

    // Actualizar la visibilidad al cambiar el nivel de zoom
    map.on('zoomend', function () {
        const currentZoom = map.getZoom();

        if (currentZoom >= 12) {
            // Mostrar la capa
            if (map.getLayoutProperty('infra-layer', 'visibility') !== 'visible') {
                map.setLayoutProperty('infra-layer', 'visibility', 'visible');
            }
        } else {
            // Ocultar la capa
            if (map.getLayoutProperty('infra-layer', 'visibility') !== 'none') {
                map.setLayoutProperty('infra-layer', 'visibility', 'none');
            }
        }
    });
}
