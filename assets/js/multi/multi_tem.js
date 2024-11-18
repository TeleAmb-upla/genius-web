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

    return layer;
}