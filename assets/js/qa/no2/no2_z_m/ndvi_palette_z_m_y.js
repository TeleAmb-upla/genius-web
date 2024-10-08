export function ToColorYear_z_m(value) {

        // Definir los colores de la paleta
        const domain = [25.813,40.313]; // mínimo y máximo 25.813,40.313

        const range =   ["#00E5FF", "#66C099", "#FFFF00", "#FF8800", "#FF0000", "#8B0000"];
        
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
    

