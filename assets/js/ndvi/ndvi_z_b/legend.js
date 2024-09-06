import { ndviToColorYear_z_b } from './ndvi_palette_z_b_y.js'; //../ndvi_z_b_y/ndvi_palette.js
import { ndviToColorMonth_z_b } from './ndvi_palette_z_b_m.js';

export function createYearLegend() {
    const legendContent = document.createElement('div');
    legendContent.id = 'yearLegend';
    legendContent.style.position = 'absolute';  
    legendContent.style.top = '50%';
    legendContent.style.left = '10px'; // Cambiar a la izquierda
    legendContent.style.transform = 'translateY(-50%)'; // Solo transformar en el eje Y
    legendContent.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    legendContent.style.padding = '10px';
    legendContent.style.zIndex = '3';

             // Agregar un título para la leyenda del año
             const title = '<h5> NDVI Anual</h5>';
  
    const ndviRanges = [
      { min: 0.1, max: 0.15 },
      { min: 0.15, max: 0.20 },
      { min: 0.20, max: 0.25 },
      { min: 0.25, max: 0.35 },
      { min: 0.35, max: 0.40 },
    ];
  
    legendContent.innerHTML = title +  ndviRanges.map(range => {
      const color = ndviToColorYear_z_b(range.min);
      return `
        <div>
          <span style="background: ${color}; width: 20px; height: 20px; display: inline-block;"></span> ${range.min.toFixed(2)} - ${range.max.toFixed(2)}
        </div>
      `;
    }).join('');
  
    return legendContent;
  }
  
  export function createMonthLegend() {
    const legendContent = document.createElement('div');
    legendContent.id = 'monthLegend';
    legendContent.style.position = 'absolute';
    legendContent.style.top = '50%';
    legendContent.style.left = '10px'; // Cambiar a la izquierda
    legendContent.style.transform = 'translateY(-50%)'; // Solo transformar en el eje Y
    legendContent.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    legendContent.style.padding = '10px';
    legendContent.style.zIndex = '2';
           // Agregar un título para la leyenda del año
           const title = '<h5> NDVI Mensual</h5>';
           const ndviRanges = [
            { min: 0.1, max: 0.15 },
            { min: 0.15, max: 0.20 },
            { min: 0.20, max: 0.25 },
            { min: 0.25, max: 0.35 },
            { min: 0.35, max: 0.40 },
          ];
  
    legendContent.innerHTML =  title + ndviRanges.map(range => {
      const color = ndviToColorMonth_z_b(range.min);
      return `
        <div>
          <span style="background: ${color}; width: 20px; height: 20px; display: inline-block;"></span> ${range.min.toFixed(2)} - ${range.max.toFixed(2)}
        </div>
      `;
    }).join('');
  
    return legendContent;
  }
  