import { legendDomain } from '../../../legend_ranges.js';
import { physicalSo2 } from '../../../raster_quantized_decode.js';

export function ToColorMonth(value) {
        const v = physicalSo2(value);
        if (Number.isNaN(v)) return null;
        // Definir los colores de la paleta#335B01
        const domain = legendDomain('so2', 'raster', 'monthly');
        const range =  ["#335B01", "#C3E934", "#FFE733", "#FFA500", "#FF4500", "#8B0000"];
        
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
    
    

   
