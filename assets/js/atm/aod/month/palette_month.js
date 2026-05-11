import { legendDomain } from '../../../legend_ranges.js';
import { physicalAod } from '../../../raster_quantized_decode.js';

export function ToColorMonth(value) {
        const v = physicalAod(value);
        if (Number.isNaN(v)) return null;
        // Definir los colores de la paleta
        const domain = legendDomain('aod', 'raster', 'monthly');
        const range = ["#00008B", "#4B0082", "#8A2BE2", "#DA70D6", "#FF69B4", "#FFC0CB"].reverse();
        
        // Calcular el paso entre cada color en función del dominio
        const step = (domain[1] - domain[0]) / (range.length - 1);
    
        // Asignar los colores basado en el valor
        if (v < domain[0]) {
            return range[0]; // Si es menor que el mínimo, devolver el primer color
        } 
        if (v > domain[1]) {
            return range[range.length - 1]; // Si es mayor que el máximo, devolver el último color
        }
    
        // Encontrar el color adecuado dentro del rango
        const index = Math.floor((v - domain[0]) / step);
        return range[index];
    }
    