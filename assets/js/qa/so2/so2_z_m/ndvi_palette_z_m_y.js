export function ToColorYear_z_m(value) {

    // Definir los colores de la paleta
    const domain = [4.404461960739052, 5.125319125299692]; // mínimo y máximo
    const range =   ["#A7F432", "#C3E934", "#FFE733", "#FFA500", "#FF4500", "#8B0000"];
    
    // Calcular el paso entre cada color en función del dominio
    const step = (domain[1] - domain[0]) / (range.length - 1);

    // Asignar los colores basado en el valor
    if (value < domain[0]) {
        return range[0]; // Si es menor que el mínimo, devolver el primer color
    } 
    if (value > domain[1]) {
        return range[range.length - 1]; // Si es mayor que el máximo, devolver el último color
    }

    // Encontrar el color adecuado dentro del rango
    const index = Math.floor((value - domain[0]) / step);
    return range[index];
}
