import { createAndDownloadNDVIZip_tif, createAndDownloadNDVIZip_json_Barrio, createAndDownloadNDVIZip_json_Manzanas } from './download/download_ndvi.js';
import{ createAndDownloadlstZip_tif_lst, createAndDownloadlstZip_json_Barrios_lst, createAndDownloadlstZip_json_Manzanas_lst} from'./download/download_lst.js';
 import { createAndDownloadAODZip, createAndDownloadAODZip_json_Barrio, createAndDownloadAODZip_json_Manzanas } from './download/download_oad.js';
import {createAndDownloadno2Zip,createAndDownloadno2Zip_json_Barrio,createAndDownloadno2Zip_json_Manzanas} from './download/download_no2.js';
import {createAndDownloadso2Zip, createAndDownloadso2Zip_json_Barrio, createAndDownloadso2Zip_json_Manzanas} from './download/download_so2.js';
import{createAndDownloadiluZip} from './download/download_ilu.js';
import { createAndDownloadhuZip} from './download/download_hu.js';  
import {createAndDownloadmultiZip} from './download/download_multi.js';
import { createAndDownloadislaZip} from './download/download_isla.js';

// Función para crear y agregar contenido al contenedor especificado
// Función para crear y agregar contenido al contenedor especificado
function addContentToContainer(containerIds, titleMetodologia, textMetodologia, titleDescripcion, textDescripcion, imageUrl, downloadLinks = []) {
    containerIds.forEach(containerId => {
        const container = document.getElementById(containerId);

        if (!container) {
            console.error('Contenedor no encontrado:', containerId);
            return;
        }

        // Limpiar cualquier contenido existente
        container.innerHTML = '';

        // Crear un contenedor flex principal
        const mainFlexContainer = document.createElement('div');
        Object.assign(mainFlexContainer.style, {
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'wrap', // Permitir que los elementos se envuelvan en pantallas pequeñas
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%',
            gap: '20px' // Espacio entre elementos
        });

        // Crear los contenedores de Descripción y Metodología con títulos y textos dinámicos
        const metodologiaContainer = createTextContainer(titleMetodologia, textMetodologia);
        const descripcionContainer = createTextContainer(titleDescripcion, textDescripcion);

        // Crear la imagen
        const image = createImage(imageUrl);

        // Crear y agregar enlaces de descarga en la descripción
        downloadLinks.forEach(downloadLinkData => {
            const downloadLink = document.createElement('a');
            downloadLink.href = '#';
            downloadLink.textContent = downloadLinkData.label;
            downloadLink.onclick = (event) => {
                event.preventDefault();  // Evitar que el enlace navegue
                downloadLinkData.action();  // Llama a la función de descarga específica
            };
            Object.assign(downloadLink.style, {
                display: 'block',
                marginTop: '10px',
                color: '#007BFF',
                textDecoration: 'none'
            });

            // Agregar un efecto de hover
            downloadLink.onmouseover = () => {
                downloadLink.style.textDecoration = 'underline';
            };
            downloadLink.onmouseout = () => {
                downloadLink.style.textDecoration = 'none';
            };

            descripcionContainer.appendChild(downloadLink);  // Agregar el enlace a la descripción
        });

        // Agregar los contenedores al contenedor flex principal
        mainFlexContainer.appendChild(metodologiaContainer);
        mainFlexContainer.appendChild(descripcionContainer);
        mainFlexContainer.appendChild(image);

        // Agregar el contenedor flex principal al contenedor principal
        container.appendChild(mainFlexContainer);
    });
}

// Función para crear un contenedor de texto (Descripción o Metodología)
function createTextContainer(title, textContent) {
    const container = document.createElement('div');
    Object.assign(container.style, {
        flex: '1 1 300px', // Flex-grow, flex-shrink, flex-basis
        minWidth: '250px',
        marginRight: '20px',
        fontFamily: 'Arial, sans-serif',
        textAlign: 'justify'
    });

    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.style.fontFamily = 'Arial, sans-serif';
    titleElement.style.fontSize = '1.2em'; // Tamaño de fuente relativo

    const paragraph = document.createElement('p');
    paragraph.style.margin = '15px 0';
    paragraph.style.lineHeight = '1.5';
    paragraph.style.fontFamily = 'Arial, sans-serif';
    paragraph.style.textAlign = 'justify';
    paragraph.style.fontSize = '1em'; // Tamaño de fuente relativo
    paragraph.textContent = textContent;

    container.appendChild(titleElement);
    container.appendChild(paragraph);

    return container;
}

// Función para crear una imagen
function createImage(src) {
    const image = document.createElement('img');
    image.src = src;
    image.alt = 'Metodología de la imagen';
    Object.assign(image.style, {
        maxWidth: '100%', // Asegura que la imagen no exceda el contenedor
        height: 'auto', // Mantiene la proporción de la imagen
        flex: '1 1 200px', // Permite flexibilidad en el diseño
        objectFit: 'contain'
    });

    return image;
}

// Función para cargar texto específico de NDVI
export async function text_ndvi() {
    const ndviContainers = ['p50', 'p51', 'p52', 'p70']; // Contenedores que mostrarán la misma información
      // Definir los enlaces de descarga específicos de NDVI
      const downloadLinks = [
        { label: 'Descargar NDVI TIF ZIP', action: createAndDownloadNDVIZip_tif },
        { label: 'Descargar NDVI GeoJson Manzanas ZIP', action: createAndDownloadNDVIZip_json_Manzanas },
        { label: 'Descargar NDVI GeoJson Barrios ZIP', action: createAndDownloadNDVIZip_json_Barrio }
    ];

    addContentToContainer(ndviContainers, 
        'Descripción  de NDVI', 
        'El Indicador de Áreas Verdes es una herramienta para medir la cantidad y la salud de la vegetación en una determinada área mediante el análisis de imágenes satelitales. Esta herramienta utiliza el índice NDVI (Normalized Difference Vegetation Index), índice que compara la cantidad de luz roja y la luz en el infrarrojo cercano que reflejan las plantas. Las plantas saludables reflejan más luz en el infrarrojo cercano que en el rojo, resultando en un valor de NDVI más alto. El NDVI es ampliamente utilizado para monitorear la cobertura vegetal en diferentes entornos, incluyendo áreas urbanas, agrícolas y forestales, permitiendo a los expertos evaluar cambios en la vegetación y planificar mejor el uso del suelo. Este indicador incluye una sección especializada para deshierbe, indicando los sectores donde hay mayor presencia de vegetación caducifolia, siendo de utilidad para gestionar sectores de vegetación potencialmente combustible. En este visualizador se incluyen las áreas verdes establecidas en el PRC, redefinidas como áreas verdes de planificación, y las áreas verdes de mantención municipal junto con los parques urbanos, redefinidos como áreas verdes de gestión.',
        'Metodología del NDVI', 
        'Se utilizaron imágenes del sensor MSI (MultiSpectral Instrument) de Sentinel-2 con un procesamiento Nivel 2 (Reflectancia Superficial) para calcular el NDVI y estudiar las áreas verdes de la ciudad. Se seleccionaron imágenes satelitales para el período 2017-2023 y se eliminaron los píxeles con nubes para asegurar datos confiables. A partir de estas imágenes, se calcularon promedios anuales y mensuales del NDVI a nivel de pixel para el área urbana de Quilpué, lo que permite observar cómo cambia la vegetación a nivel espacial y temporal. Se realizó un análisis detallado por zonas, evaluando el NDVI a diferentes escalas, como barrios y manzanas, para entender mejor la distribución de las áreas verdes en diferentes partes de la ciudad. También se calculó la tendencia utilizando el método de Sen’s Slope, a escala de pixel, manzana y barrios. Los valores de tendencia en este indicador no son estadísticamente significativos debido a la baja cantidad de años de medición. Finalmente, se desarrolló un subindicador especializado para deshierbe, calculado como la desviación estándar de los valores mensuales de NDVI de todo el período abordado, a nivel de píxel.',
        '/assets/img/Iconos_Genius/GENIUS-NG-VEG.png',
        downloadLinks
    );
}

// Función para cargar texto específico de LST
export async function text_lst() {
    const lstContainers = ['p53', 'p54', 'p55']; // Contenedores que mostrarán la misma información
    const downloadLinks = [
        { label: 'Descargar LST TIF ZIP', action: createAndDownloadlstZip_tif_lst },
        { label: 'Descargar LST GeoJson Manzanas ZIP', action: createAndDownloadlstZip_json_Manzanas_lst },
        { label: 'Descargar LST GeoJson Barrios ZIP', action:     createAndDownloadlstZip_json_Barrios_lst }
    ];
    addContentToContainer(lstContainers, 
        'Descripción  de LST', 
        'El Indicador de Temperatura Superficial (LST, por sus siglas en inglés) es una herramienta para medir la temperatura en la superficie terrestre mediante el análisis de imágenes satelitales. Este indicador utiliza datos satelitales calcular la temperatura en grados Celsius, empleando principalmente la porción del espectro electromagnético correspondiente al infrarrojo térmico. Esto permite estudiar y monitorear fenómenos relacionados con el clima. Uno de los usos principales del LST es la evaluación del efecto de isla de calor urbana, fenómeno que ocurre cuando las áreas urbanas presentan temperaturas más altas que sus alrededores debido a la actividad humana y la infraestructura, como el pavimento y los edificios. Este indicador está incluido en esta visualización y es fundamental en la gestión climática y la planificación urbana, proporcionando información crítica para la toma de decisiones en estas áreas.',
        'Metodología de LST', 
        'Se utilizaron imágenes del sensor TIRS (Thermal Infrared Sensor) de Landsat 5, 8 y 9 con un procesamiento Nivel 2 (Reflectancia Superficial) para calcular la temperatura superficial. Se seleccionaron para el período 1995-2023 y se aplicó un filtro para eliminar las nubes, asegurando así datos más precisos. Posteriormente, se calcularon promedios anuales y mensuales de la temperatura superficial para observar cambios dentro de la zona urbana y a lo largo del tiempo a nivel de píxel. Además, se realizó un análisis detallado por zonas, evaluando la temperatura superficial a nivel de barrios y manzanas para comprender mejor la distribución del calor en la ciudad. También se calculó la tendencia utilizando el método de Sen’s Slope, a escala de pixel, manzana y barrios y se obtuvieron resultados estadísticamente significativos. Los valores de tendencia en este indicador no son estadísticamente significativos. Finalmente, se desarrolló un subindicador especializado para observar intensidad y distribución de islas de calor sobre la zona urbana de Quilpué.',
        '/assets/img/Iconos_Genius/GENIUS-NG-TEMP.png',
        downloadLinks
    );
}

// Función para cargar texto específico de AOD
export async function text_aod() {
    const aodContainers = ['p56', 'p57', 'p58']; // Contenedores que mostrarán la misma información

    const downloadLinks = [
        { label: 'Descargar AOD TIF ZIP', action: createAndDownloadAODZip },
        { label: 'Descargar AOD GeoJson Manzanas ZIP', action: createAndDownloadAODZip_json_Barrio },
        { label: 'Descargar AOD GeoJson Barrios ZIP', action:     createAndDownloadAODZip_json_Manzanas }
    ];

    addContentToContainer(aodContainers, 
        'Descripción  de AOD', 
        'El Indicador de Profundidad Óptica de Aerosoles (AOD) mide la cantidad de partículas sólidas o líquidas suspendidas en la atmósfera, como polvo, humo, y otras partículas finas. Este indicador es crucial para monitorear la calidad del aire, ya que una mayor concentración de aerosoles puede afectar la visibilidad, la salud humana y el clima También ha sido estudiado como proxy de material particulado de 2.5 μm (PM2.5). AOD se calcula utilizando datos satelitales que miden la cantidad de luz solar que se dispersa o se absorbe al pasar por la atmósfera. Este valor proporciona información valiosa para la gestión de la contaminación del aire y la salud pública. ',
        'Metodología de AOD', 
        'Se utilizaron imágenes del producto ‘MCD19A2 V6.1’, midiendo partículas atmosféricas hasta una altitud de 4.2 km, basado en modelo MAIAC-AOD (Multi-angle Implementation of Atmospheric Correction- Land Aerosol Optical Depth) sobre el sensor MODIS de los satélites AQUA y TERRA, seleccionando imágenes entre 2001 y 2023. El producto AOD no tiene unidad. Primero, se aplicó un filtro para eliminar las nubes y mejorar la precisión de los datos, asegurando que solo se usaran imágenes de alta calidad. Luego, se calcularon promedios anuales de AOD y mensuales para identificar cambios en la concentración de aerosoles a lo largo del tiempo y el espacio. Debido a la resolución espacial del producto (1000 m), el análisis incluyó el cálculo de concentraciones en toda la región de Valparaíso, permitiendo observar cómo varía la calidad del aire en diferentes áreas de la zona a nivel de pixel. También se realizaron promedios de AOD a escala de barrios y manzanas en la zona urbana de Quilpué. Adicionalmente, se calculó la tendencia utilizando el método de Sen’s Slope a escala de pixel, manzana y barrios. Los valores de tendencia en este indicador no son estadísticamente significativos.',
        './assets/img/Iconos_Genius/GENIUS-NG-12.png',
        downloadLinks
    );
}

// Función para cargar texto específico de NO2
export async function text_no2() {
    const no2Containers = ['p59', 'p60', 'p61'];  // Contenedores que mostrarán la misma información
    
        const downloadLinks = [
        { label: 'Descargar NO² TIF ZIP', action: createAndDownloadno2Zip },
        { label: 'Descargar NO² GeoJson Manzanas ZIP', action: createAndDownloadno2Zip_json_Barrio },
        { label: 'Descargar NO² GeoJson Barrios ZIP', action:     createAndDownloadno2Zip_json_Manzanas }
    ];
    addContentToContainer(no2Containers, 
        'Descripción  de NO2', 
        'El Indicador de Dióxido de Nitrógeno (NO2) mide el NO2 (mol/m2) en la atmósfera, un gas contaminante que resulta procesos de combustión, generando altas concentraciones sobre zonas con tráfico intenso y tiene efectos adversos sobre la salud humana y el medio ambiente. Este indicador es crucial para evaluar la calidad del aire, ya que el NO2 contribuye a la formación de ozono troposférico y partículas finas. Las concentraciones de NO2 se calculan utilizando datos satelitales que miden la cantidad de luz solar que se dispersa o se absorbe al pasar por la atmósfera,  permitiendo observar de su distribución a nivel regional y local. ', 
        'Metodología de NO2', 
        'Para el análisis en la región de Valparaíso, se utilizaron datos del sensor TROPOMI (TROPOspheric Monitoring Instrument) del satélite Sentinel-5P, que proporciona mediciones de NO2 en la tropósfera a partir de imágenes del producto ‘OFFL/L3_NO2’, utilizando imágenes desde el 2019 hasta 2023. Este producto mide la densidad de columna vertical troposférica. Se aplicaron filtros para enmascarar nubes y valores negativos, asegurando datos de alta calidad. Debido a la resolución espacial del producto (1113.2 m), el análisis incluyó el cálculo de concentraciones anuales y mensuales en toda la región de Valparaíso a nivel de píxel. También se calcularon promedios anuales, mensuales a nivel de manzanas y barrios. Adicionalmente, se calculó la tendencia utilizando el método de Sen’s Slope a escala de pixel, manzana y barrios. Los valores de tendencia en este indicador no son estadísticamente significativos debido a la poca cantidad de años de medición.', 
        './assets/img/Iconos_Genius/GENIUS-NG-12.png',
        downloadLinks
    );
}

// Función para cargar texto específico de SO2
export async function text_so2() {
    const so2Containers = ['p62', 'p63', 'p64']; // Contenedores que mostrarán la misma información
    const downloadLinks = [
        { label: 'Descargar SO² TIF ZIP', action: createAndDownloadso2Zip },
        { label: 'Descargar SO² GeoJson Manzanas ZIP', action: createAndDownloadso2Zip_json_Barrio },
        { label: 'Descargar SO² GeoJson Barrios ZIP', action:     createAndDownloadso2Zip_json_Manzanas }
    ];
    addContentToContainer(so2Containers, 
        'Descripción  de SO2', 
        'El Indicador de Dióxido de Azufre (SO2) mide la concentración de SO2 (mol/m2) la atmósfera, un gas contaminante generado principalmente por la quema de combustibles fósiles y procesos industriales. El SO2 es perjudicial para la salud humana y puede contribuir a la formación de partículas finas y ácidos en el aire. Las concentraciones de SO2 se calculan utilizando datos satelitales que miden la cantidad de luz solar que se dispersa o se absorbe al pasar por la atmósfera, permitiendo observar de su distribución a nivel regional y local.',
        'Metodología de SO2', 
        ' Se utilizaron datos del sensor TROPOMI (TROPOspheric Monitoring Instrument) del satélite Sentinel-5P, obteniendo imágenes del producto ‘OFFL/L3_SO2’ desde 2019 hasta 2023. Este producto mide la densidad de la columna vertical a nivel de suelo. Se aplicaron filtros para enmascarar nubes y valores atípicos negativos, asegurando la calidad de los datos. Se calcularon estadísticas anuales y mensuales para evaluar las variaciones en la concentración de SO2 a lo largo del tiempo. Los datos fueron analizados a escala del Gran Valparaíso y a escala de barrios y manzanas dentro de los distritos urbanos de Quilpué para identificar patrones espaciales en la calidad del aire.', 
        './assets/img/Iconos_Genius/GENIUS-NG-12.png',
        downloadLinks
    );
}

// Función para cargar texto específico de Luminosidad
export async function text_lum() {
    const lumContainer = ['p65']; // Contenedor que mostrará la información de Luminosidad
    const downloadLinks = [
        { label: 'Descargar Iluminacion GeoJson ZIP', action: createAndDownloadiluZip },
       
    ];
    addContentToContainer(lumContainer, 
        'Descripción  de Luminosidad', 
        'El indicador de Iluminación Artificial se utiliza para monitorear la iluminación urbana, identificar áreas urbanizadas, evaluar la contaminación lumínica y analizar la expansión de las ciudades. Es particularmente útil para detectar zonas con déficit de iluminación pública, lo que es crucial para garantizar la seguridad de la población.', 
        'Metodología de Luminosidad', 
        'La metodología consistió en realizar vuelos nocturnos entre julio y agosto de 2024 sobre la zona urbana de Quilpué con el dron MAVIC 3T Enterprise, equipado con una cámara RGB y una térmica. El dron voló a 300 metros de altura y a baja velocidad para capturar adecuadamente la luz en el entorno nocturno. Se tomaron más de 12,000 fotos, que luego fueron procesadas para crear un mosaico detallado de la zona urbana utilizando el software Agisoft Metashape Professional. Finalmente, se realizó una clasificación no supervisada con tres categorías para identificar niveles de brillo, y se ajustó la resolución de las imágenes para facilitar su visualización.', 
        './assets/img/Iconos_Genius/GENIUS-NG-13.png',
        downloadLinks

    );
}

// Función para cargar texto específico de Huella Urbana
export async function text_hu() {
    const huContainer = ['p66']; // Contenedor que mostrará la información de Huella Urbana createAndDownloadhuZip
    const downloadLinks = [
        { label: 'Descargar Huella Urbana TIF ZIP', action: createAndDownloadhuZip },
       
    ];
    addContentToContainer(huContainer, 
        'Descripción  de Huella Urbana', 
        'El Indicador de Huella Urbana mide la extensión espacial del área urbanizada, abarcando construcciones, superficies impermeables y ejes estructurantes dentro de una zona determinada. Este indicador es fundamental para analizar y comprender cómo evolucionan las áreas urbanas a lo largo del tiempo. Su aplicación permite a los planificadores y gestores territoriales tomar decisiones informadas sobre el crecimiento y la expansión de las ciudades, facilitando la gestión eficiente del territorio y la adaptación a las dinámicas urbanas emergentes.', 
        'Metodología de Huella Urbana', 
        'Se emplearon imágenes multiespectrales de Sentinel-2 y de radar SAR de Sentinel-1 para detectar la huella urbana utilizando imágenes de verano desde 2018 hasta 2023, utilizando el algoritmo de aprendizaje automático Random Forest y entrenado con datos de 2018. Las imágenes Sentinel-2, que incluyen 13 bandas a 10 metros de resolución, se procesaron como medianas mensuales con un filtro de nubosidad. Las imágenes SAR de Sentinel-1 proporcionaron indicadores de retrodispersión y coherencia, que complementaron la detección óptica proporcionada por Sentine-2. La clasificación final integró 24 indicadores satelitales combinados, y se evaluó con una matriz de confusión, obteniendo coeficientes kappa entre 0.73 y 0.95, destacando algunas limitaciones en invierno debido a la nubosidad. El producto final entrega una imagen binaria que identifica los píxeles con áreas construidas y no construidas.', 
        './assets/img/Iconos_Genius/GENIUS-NG-16.png',
        downloadLinks
    );
}

export async function text_multi() {
    const multiContainers = ['p76']; 
    const downloadLinks = [
        { label: 'Descargar MultiCapa ZIP', action: createAndDownloadmultiZip },
    ];
    addContentToContainer(multiContainers,
        'Descripción de MultiCapa (Versión Beta)', 
        'MultiCapa es una herramienta que integra múltiples capas de información en una sola visualización, diseñada para ofrecer una comprensión integral de un área de estudio. Esta herramienta combina datos clave, tales como: Imágenes de alta resolución en RGB: Imagen de color real capturadas por drones que permiten observar detalles como la materialidad e infraestructura con gran claridad. Iluminación nocturna: Información procesada y clasificada sobre los niveles de iluminación, obtenida también mediante drones, ideal para evaluar la calidad del alumbrado público. Temperatura superficial: Datos precisos capturados con drones y sensores térmicos para analizar patrones térmicos en la superficie en una resolución espacial de centímetros. Gracias a esta integración, los planificadores y gestores urbanos pueden analizar cómo interactúan diferentes aspectos del espacio físico, lo que facilita la toma de decisiones informadas para la planificación y gestión territorial.',
        'Descargar MultiCapa ZIP', 
        '', 
        './assets/img/Iconos_Genius/GENIUS-multicapa.png',
        downloadLinks
    );
}


export async function text_isla(){
    const multiContainers = ['p74'];
    const downloadLinks = [
        { label: 'Descargar Isla de calor GeoJson ZIP', action: createAndDownloadislaZip },
    ];
    addContentToContainer(multiContainers,
        'Descripción de Isla de Calor', 
        'Para obtener los valores que conforman el visualizador, se utiliza la metodología propuesta por Sarricolea y Vide (2014). En este enfoque, se emplean los valores de temperatura previamente calculados para la temperatura superficial (LST), con todas sus especificaciones. A continuación, se identifica el píxel con el valor térmico más bajo, el cual se define como el representante del área rural. A este valor se le resta a cada una de las imágenes, lo que da como resultado un conjunto de valores que posteriormente se categorizan en cuatro clases: la clase 0, que corresponde a valores entre 0 y 3°C; la clase 1, que abarca valores de 3 a 6°C; la clase 2, para valores de 6 a 9°C; y la clase 3, que incluye valores superiores a los 9°C.', 
        'Metodología de Isla de Calor', 
        'Las islas de calor urbano de superficie (ICUs) son fenómenos generados por la diferencia de temperatura superficial (LST) entre áreas urbanas y rurales. Esta diferencia se puede expresar como: Δ°T = °T(urbano) − °T(rural). Las ICUs revelan la distribución térmica dentro de las ciudades, mostrando tanto puntos calientes (Hotspots) como puntos frescos (Coldspots). Su intensidad es generalmente mayor durante el día y varía según las estaciones del año, siendo más pronunciada en los meses de verano. Los valores de la LST, cuando se procesan para identificar estas islas de calor, se expresan en grados Celsius (°C) por consiguiente los valores expuestos también serán en estos valores.La zonificación y espacialización de las islas de calor son herramientas clave en la planificación urbana, ya que permiten identificar las áreas más afectadas y proponer estrategias efectivas para mitigar sus efectos negativos. Este enfoque contribuye a la creación de ciudades más sostenibles y equitativas, promoviendo una transición hacia entornos urbanos climáticamente más justos.',
        './assets/img/Iconos_Genius/GENIUS-NG-11.png',
        downloadLinks
    );

}