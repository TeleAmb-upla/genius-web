export function ToColorMonth_z_b(value) {
        // Definir los colores de la paleta 26.625,40.188

        const domain = [17,129]; // mínimo y máximo 17,129

        const range =  [ '#333333', // black
            '#0000FF', // blue
            '#800080', // purple
            '#00FFFF', // cyan
            '#008000', // green
            '#FFFF00', // yellow
            '#FF0000'  // red
          ];
        
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
    