import { legendDomain } from '../../legend_ranges.js';
import { physicalNdvi } from '../../raster_quantized_decode.js';

export function ndviToColor(ndvi) {
    const ndviV = physicalNdvi(ndvi);
    if (Number.isNaN(ndviV)) return null;
    const domain = legendDomain('ndvi', 'raster', 'yearly');
    // Paleta de colores invertida que representa los diferentes valores de NDVI
    const range = [    '#ff0000', // Rojo intenso
        '#DF923D', // Naranja
        '#FCD163', // Amarillo
        '#74A901', // Verde claro
        '#2E5D2D', // Verde oscuro
        '#194D18'];  // Casi negro, muy oscuro verde

    // Calcular el paso entre cada color en función del dominio
    const step = (domain[1] - domain[0]) / (range.length - 1);

    // Asignar los colores basado en el valor
    if (ndviV < domain[0]) {
        return range[0]; // Si es menor que el mínimo, devolver el primer color
    } 
    if (ndviV > domain[1]) {
        return range[range.length - 1]; // Si es mayor que el máximo, devolver el último color
    }

    // Encontrar el color adecuado dentro del rango
    const index = Math.floor((ndviV - domain[0]) / step);
    return range[index];
}
