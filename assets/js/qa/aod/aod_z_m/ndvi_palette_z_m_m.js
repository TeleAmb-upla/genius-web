export function ToColorMonth_z_m(value) {

            // Definir los colores de la paleta
            const domain = [73.3, 131.9]; // mínimo y máximo
            const range =  ["#00008B", "#4B0082", "#8A2BE2", "#DA70D6", "#FF69B4", "#FFC0CB"].reverse();
            
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
        