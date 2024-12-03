import * as d3 from 'https://cdn.skypack.dev/d3@7';

 function ToColor(value) { 
    // Definir el dominio mínimo y máximo
    const domain = [0, 34.3999]; // mínimo y máximo 

    // Definir los colores de la paleta
    const range = ["#00008B", "#00BFFF", "#32CD32", "#FFFF00", "#FFA500", "#FF4500"];
    
    // Crear la escala de colores con D3
    const colorScale = d3.scaleLinear()
        .domain(d3.range(domain[0], domain[1], (domain[1] - domain[0]) / (range.length - 1)).concat(domain[1]))
        .range(range)
        .interpolate(d3.interpolateRgb);  // Interpolación RGB para gradiente suave
    
    // Si el valor es menor que el mínimo, devolver el primer color
    if (value < domain[0]) {
        return range[0];
    } 
    // Si el valor es mayor que el máximo, devolver el último color
    if (value > domain[1]) {
        return range[range.length - 1];
    }

    // Devolver el color interpolado basado en el valor
    return colorScale(value);
}
export async function m_tem(map) {
    // Leer el archivo GeoTIFF
    const response = await fetch('/assets/vec/raster/multi/PlazaVieja_Dia_Termico.tif');
    const arrayBuffer = await response.arrayBuffer();

    // Parsear el GeoRaster
    const georaster = await parseGeoraster(arrayBuffer);

    // Crear la capa GeoRaster con la función de colores ajustada
    const layer = new GeoRasterLayer({
        georaster: georaster,
        resolution: 256, // Ajusta según sea necesario
        pixelValuesToColorFn: function (value) {
            // Asegurarte de no procesar valores nulos o no válidos
            if (value === null || isNaN(value)) return 'transparent';
            return ToColor(value);
        }
    });

    // Manejador de clic
    function onMapClick(e) {
        const latlng = e.latlng;
        const value = geoblaze.identify(georaster, [latlng.lng, latlng.lat]);

        if (value && value.length > 0) {
            const rasterValue = value[0];

            // Mostrar el valor en un popup
            L.popup()
                .setLatLng(latlng)
                .setContent(`<strong>Temperatura:</strong> ${rasterValue.toFixed(2)} °C`)
                .openOn(map);
        } else {
            // No hay valor en esta ubicación
            console.log('No se pudo obtener el valor del raster en esta ubicación');
        }
    }

    // Manejador de movimiento del ratón
    function onMapMouseMove(e) {
        const value = geoblaze.identify(georaster, [e.latlng.lng, e.latlng.lat]);
        if (value && value.length > 0 && !isNaN(value[0])) {
            map.getContainer().style.cursor = 'pointer';
        } else {
            map.getContainer().style.cursor = '';
        }
    }

    // Cuando la capa se añade al mapa, adjuntamos los eventos
    layer.on('add', function () {
        map.on('click', onMapClick);
        map.on('mousemove', onMapMouseMove);
    });

    // Cuando la capa se elimina del mapa, eliminamos los eventos
    layer.on('remove', function () {
        map.off('click', onMapClick);
        map.off('mousemove', onMapMouseMove);
        // Restaurar el cursor
        map.getContainer().style.cursor = '';
    });

    // No añadimos la capa al mapa aquí; se gestionará en multi_capa()
    return layer;
}