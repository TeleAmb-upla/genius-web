export function ndviToColorYear_z_b(ndvi) {
  
    const domain = [-0.3359, 0.7422]; // mínimo y máximo
    // Paleta de colores invertida que representa los diferentes valores de NDVI
    const range = [    '#ff0000', // Rojo intenso
        '#DF923D', // Naranja
        '#FCD163', // Amarillo
        '#74A901', // Verde claro
        '#023B01', // Verde oscuro
        '#011301'];  // Casi negro, muy oscuro verde

    // Calcular el paso entre cada color en función del dominio
    const step = (domain[1] - domain[0]) / (range.length - 1);

    // Asignar los colores basado en el valor
    if (ndvi < domain[0]) {
        return range[0]; // Si es menor que el mínimo, devolver el primer color
    } 
    if (ndvi > domain[1]) {
        return range[range.length - 1]; // Si es mayor que el máximo, devolver el último color
    }

    // Encontrar el color adecuado dentro del rango
    const index = Math.floor((ndvi - domain[0]) / step);
    return range[index];
}
