// Función para crear y agregar contenido al contenedor especificado
function addContentToContainer(containerIds, titleMetodologia, textMetodologia, titleDescripcion, textDescripcion, imageUrl) {
    // Iterar sobre cada ID de contenedor proporcionado
    containerIds.forEach(containerId => {
        // Obtener el contenedor por su ID
        const container = document.getElementById(containerId);

        // Verificar si el contenedor existe
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
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            width: '100%',
            height: '100%'
        });

        // Crear los contenedores de Descripción  y Metodología con títulos y textos dinámicos
        const metodologiaContainer = createTextContainer(titleMetodologia, textMetodologia);
        const descripcionContainer = createTextContainer(titleDescripcion, textDescripcion);

        // Crear la imagen
        const image = createImage(imageUrl);

        // Agregar los contenedores al contenedor flex principal
        mainFlexContainer.appendChild(metodologiaContainer);
        mainFlexContainer.appendChild(descripcionContainer);
        mainFlexContainer.appendChild(image);

        // Agregar el contenedor flex principal al contenedor principal
        container.appendChild(mainFlexContainer);
    });
}

// Función para crear un contenedor de texto (Descripción  o Metodología)
function createTextContainer(title, textContent) {
    const container = document.createElement('div');
    Object.assign(container.style, {
        width: '30%',
        marginRight: '20px',
        fontFamily: 'Arial',
        textAlign: 'justify'
    });

    const titleElement = document.createElement('h3');
    titleElement.textContent = title;
    titleElement.style.fontFamily = 'Arial';

    const paragraph = document.createElement('p');
    paragraph.style.margin = '15px 0';
    paragraph.style.lineHeight = '1.5';
    paragraph.style.fontFamily = 'Arial';
    paragraph.style.textAlign = 'justify';
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
        maxWidth: '90%',
        height: '100%',
        width: '35%',
        objectFit: 'contain'
    });

    return image;
}

// Función para cargar texto específico de NDVI
export async function text_ndvi() {
    const ndviContainers = ['p50', 'p51', 'p52']; // Contenedores que mostrarán la misma información
    addContentToContainer(ndviContainers, 
        'Descripción  de NDVI', 
        'El Indicador de Áreas Verdes es una herramienta para medir la cantidad y la salud de la vegetación en una determinada área mediante el análisis de imágenes satelitales. Esta herramienta utiliza el índice NDVI (Normalized Difference Vegetation Index), índice que compara la cantidad de luz roja y la luz en el infrarrojo cercano que reflejan las plantas. Las plantas saludables reflejan más luz en el infrarrojo cercano que en el rojo, resultando en un valor de NDVI más alto. El NDVI es ampliamente utilizado para monitorear la cobertura vegetal en diferentes entornos, incluyendo áreas urbanas, agrícolas y forestales, permitiendo a los expertos evaluar cambios en la vegetación y planificar mejor el uso del suelo.', 
        'Metodología del NDVI', 
        'En el análisis de Quilpué, se utilizaron imágenes del sensor MSI (MultiSpectral Instrument) de Sentinel-2 con un procesamiento Nivel 2 (Reflectancia Superficial) para calcular el NDVI y estudiar las áreas verdes de la ciudad. Primero, se seleccionaron las imágenes satelitales y se eliminaron las nubes para asegurar datos claros. A partir de estas imágenes, se calcularon promedios anuales y mensuales del NDVI, lo que permite observar cómo cambia la vegetación a lo largo del tiempo a nivel. También se realizó un análisis detallado por zonas, evaluando el NDVI a diferentes escalas, como barrios y manzanas, para entender mejor la distribución de las áreas verdes en diferentes partes de la ciudad. Esto facilita la identificación de zonas que podrían necesitar conservación o mejora.', 
        './assets/img/Iconos_Genius/GENIUS-NG-10.png'
    );
}

// Función para cargar texto específico de LST
export async function text_lst() {
    const lstContainers = ['p53', 'p54', 'p55']; // Contenedores que mostrarán la misma información
    addContentToContainer(lstContainers, 
        'Descripción  de LST', 
        'El Indicador de Temperatura Superficial (LST) mide la temperatura en la superficie terrestre utilizando imágenes satelitales. Este indicador es útil para monitorear el clima y estudiar fenómenos como el efecto de isla de calor urbana, que se produce cuando las áreas urbanas son más cálidas que sus alrededores debido a la actividad humana y la infraestructura. Utilizando datos de satélites Landsat, se calcula la temperatura de la superficie terrestre en grados Celsius, proporcionando información crucial para la gestión del clima, la agricultura y la planificación urbana.', 
        'Metodología de LST', 
        'En el análisis de Quilpué, se utilizaron imágenes del sensor TIRS (Thermal Infrared Sensor) de Landsat 8 y 9 con un procesamiento Nivel 2 (Reflectancia Superficial) para calcular la temperatura superficial. Primero, se seleccionaron imágenes de Landsat 8 y 9 y se aplicó un filtro para eliminar las nubes, asegurando así datos más precisos. Luego, se convirtieron los datos de temperatura de Kelvin a grados Celsius. Posteriormente, se calcularon promedios anuales y mensuales de la temperatura superficial para observar cambios a lo largo del tiempo. Además, se realizó un análisis detallado por zonas, evaluando la temperatura superficial a nivel de barrios y manzanas para comprender mejor la distribución del calor en la ciudad. Esto facilita la identificación de áreas que podrían necesitar intervenciones para mitigar el calor excesivo o adaptar el entorno urbano a condiciones más frescas.', 
        './assets/img/Iconos_Genius/GENIUS-NG-11.png'
    );
}

// Función para cargar texto específico de AOD
export async function text_aod() {
    const aodContainers = ['p56', 'p57', 'p58']; // Contenedores que mostrarán la misma información
    addContentToContainer(aodContainers, 
        'Descripción  de AOD', 
        'El Indicador de Profundidad Óptica de Aerosoles (AOD) mide la cantidad de partículas sólidas o líquidas suspendidas en la atmósfera, como polvo, humo, y otras partículas finas. Este indicador es crucial para monitorear la calidad del aire, ya que una mayor concentración de aerosoles puede afectar la visibilidad, la salud humana y el clima, también es un buen proxy para medir material particulado de 2.5 μm (PM2.5). AOD se calcula utilizando datos satelitales que miden la cantidad de luz solar que se dispersa o se absorbe al pasar por la atmósfera. Este valor proporciona información valiosa para la gestión de la contaminación del aire y la salud pública.', 
        'Metodología de AOD', 
        'Para el análisis en la región de Valparaíso, se utilizaron imágenes del producto ‘MCD19A2 V6.1’, midiendo partículas atmosféricas hasta una altitud de 4.2 km, basado en modelo MAIAC-AOD (Multi-angle Implementation of Atmospheric Correction- Land Aerosol Optical Depth) sobre el sensor MODIS de los satélites AQUA y TERRA, entre 2001 y 2023. El producto AOD no tiene unidad. Primero, se aplicó un filtro para eliminar las nubes y mejorar la precisión de los datos, asegurando que solo se usaran imágenes de alta calidad. Luego, se calcularon promedios anuales de AOD y mensuales para identificar cambios en la concentración de aerosoles a lo largo del tiempo. El análisis incluyó la evaluación de los datos a escala de Gran Valparaiso, permitiendo observar cómo varía la calidad del aire en diferentes áreas de la zona, a escala de barrios y manzanas en Quilpué. ', 
        './assets/img/Iconos_Genius/GENIUS-NG-12.png'
    );
}

// Función para cargar texto específico de NO2
export async function text_no2() {
    const no2Containers = ['p59', 'p60', 'p61']; // Contenedores que mostrarán la misma información
    addContentToContainer(no2Containers, 
        'Descripción  de NO2', 
        'El Indicador de Dióxido de Nitrógeno (NO2) mide el NO2 (mol/m2) en la atmósfera, un gas contaminante que resulta de la quema de combustibles fósiles y tiene efectos adversos sobre la salud humana y el medio ambiente. Este indicador es crucial para evaluar la calidad del aire, ya que el NO2 contribuye a la formación de ozono troposférico y partículas finas. La medición de NO2 se realiza utilizando datos satelitales que proporcionan una vista detallada de su distribución a nivel regional.', 
        'Metodología de NO2', 
        'Para el análisis en la región de Valparaíso, se utilizaron datos del sensor TROPOMI (TROPOspheric Monitoring Instrument) del satélite Sentinel-5P, que proporciona mediciones de NO2  en la tropósfera a partir de imágenes del producto ‘OFFL/L3_NO2’, desde el año 2019 hasta 2013. Este producto mide la densidad de columna vertical troposférica. Se aplicaron filtros para enmascarar nubes y valores negativos, asegurando datos de alta calidad. Se calcularon promedios anuales, mensuales. Los datos fueron analizados a escala del Gran Valparaíso, así como a escala de barrios y manzanas de los distritos urbanos de Quilpué, permitiendo observar variaciones espaciales en la concentración de NO2.', 
        './assets/img/Iconos_Genius/GENIUS-NG-12.png'
    );
}

// Función para cargar texto específico de SO2
export async function text_so2() {
    const so2Containers = ['p62', 'p63', 'p64']; // Contenedores que mostrarán la misma información
    addContentToContainer(so2Containers, 
        'Descripción  de SO2', 
        'El Indicador de Dióxido de Azufre (SO2) mide la concentración de SO2 (mol/m2) la atmósfera, un gas contaminante generado principalmente por la quema de combustibles fósiles y procesos industriales. El SO2 es perjudicial para la salud humana y puede contribuir a la formación de partículas finas y ácidos en el aire. Este indicador se basa en mediciones satelitales que proporcionan una visión detallada de la distribución y variabilidad del SO2 en la región.', 
        'Metodología de SO2', 
        ' Se utilizaron datos del sensor TROPOMI (TROPOspheric Monitoring Instrument) del satélite Sentinel-5P, obteniendo imágenes del producto ‘OFFL/L3_SO2’ desde 2019 hasta 2023. Este producto mide la densidad de la columna vertical a nivel de suelo. Se aplicaron filtros para enmascarar nubes y valores atípicos negativos, asegurando la calidad de los datos. Se calcularon estadísticas anuales y mensuales para evaluar las variaciones en la concentración de SO2 a lo largo del tiempo. Los datos fueron analizados a escala del Gran Valparaíso y a escala de barrios y manzanas dentro de los distritos urbanos de Quilpué para identificar patrones espaciales en la calidad del aire.', 
        './assets/img/Iconos_Genius/GENIUS-NG-12.png'
    );
}

// Función para cargar texto específico de Luminosidad
export async function text_lum() {
    const lumContainer = ['p65']; // Contenedor que mostrará la información de Luminosidad
    addContentToContainer(lumContainer, 
        'Descripción  de Luminosidad', 
        'El indicador de Iluminación Artificial se utiliza para monitorear la iluminación urbana, identificar áreas urbanizadas, evaluar la contaminación lumínica y analizar la expansión de las ciudades. Es particularmente útil para detectar zonas con déficit de iluminación pública, lo que es crucial para garantizar la seguridad de la población.', 
        'Metodología de Luminosidad', 
        'La metodología consistió en realizar vuelos nocturnos con un dron equipado con una cámara multiespectral sobre la zona urbana de Quilpué. El dron voló a 300 metros de altura y a baja velocidad para capturar adecuadamente la luz en el entorno nocturno. Se tomaron más de 12,000 fotos, que luego fueron procesadas para crear un mosaico detallado de la zona urbana utilizando el software Pix4D Mapper. Finalmente, se realizó una clasificación no supervisada con tres categorías para identificar niveles de brillo, y se ajustó la resolución de las imágenes para facilitar su visualización.', 
        './assets/img/Iconos_Genius/GENIUS-NG-13.png'
    );
}

// Función para cargar texto específico de Huella Urbana
export async function text_hu() {
    const huContainer = ['p66']; // Contenedor que mostrará la información de Huella Urbana
    addContentToContainer(huContainer, 
        'Descripción  de Huella Urbana', 
        'El Indicador de Huella Urbana mide la extensión espacial del área urbanizada, abarcando construcciones, superficies impermeables y ejes estructurantes dentro de una zona determinada. Este indicador es fundamental para analizar y comprender cómo evolucionan las áreas urbanas a lo largo del tiempo. Su aplicación permite a los planificadores y gestores territoriales tomar decisiones informadas sobre el crecimiento y la expansión de las ciudades, facilitando la gestión eficiente del territorio y la adaptación a las dinámicas urbanas emergentes.', 
        'Metodología de Huella Urbana', 
        'Se emplearon imágenes multiespectrales de Sentinel-2 y de radar SAR de Sentinel-1 para detectar la huella urbana utilizando imágenes de verano desde 2018 hasta 2023, utilizando un modelo Random Forest entrenado con datos de 2018. Las imágenes Sentinel-2, que incluyen 13 bandas a 10 metros de resolución, se procesaron como medianas mensuales con un filtro de nubosidad. Las imágenes SAR de Sentinel-1 proporcionaron indicadores de retrodispersión y coherencia, complementando la detección óptica. La clasificación final integró 24 indicadores satelitales combinados, y se evaluó con una matriz de confusión, obteniendo coeficientes kappa entre 0.73 y 0.95, destacando algunas limitaciones en invierno debido a la nubosidad. ', 
        './assets/img/Iconos_Genius/GENIUS-NG-16.png'
    );
}
