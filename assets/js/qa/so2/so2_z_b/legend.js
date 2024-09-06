import { ToColorYear_z_b } from './ndvi_palette_z_b_y.js'; 
import { ToColorMonth_z_b } from './ndvi_palette_z_b_m.js';

export function createYearLegend() {
    const legendContent = document.createElement('div');
    legendContent.id = 'yearLegend';
    legendContent.style.position = 'absolute';  
    legendContent.style.top = '50%';
    legendContent.style.left = '10px'; // Cambiar a la izquierda
    legendContent.style.transform = 'translateY(-50%)'; // Solo transformar en el eje Y
    legendContent.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    legendContent.style.padding = '10px';
    legendContent.style.zIndex = '2';
                    // Agregar un título para la leyenda del año
                    const title = '<h5> SO² </h5>';
    const Ranges = [
      { min: -0.3359, max: -0.1 },
      { min: -0.1, max: 0 },
      { min: 0, max: 0.1 },
      { min: 0.1, max: 0.2 },
      { min: 0.2, max: 0.3 },
      { min: 0.3, max: 0.4 },
      { min: 0.4, max: 0.5 },
      { min: 0.5, max: 0.6 },
      { min: 0.6, max: 0.7422 }
    ];
  
    legendContent.innerHTML = title + Ranges.map(range => {
      const color = ToColorYear_z_b(range.min);
      return `
        <div>
          <span style="background: ${color}; width: 20px; height: 20px; display: inline-block;"></span> ${range.min.toFixed(1)} - ${range.max.toFixed(1)}
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
                    const title = '<h5> SO² </h5>';
    const Ranges = [
      { min: -0.3359, max: -0.1 },
      { min: -0.1, max: 0 },
      { min: 0, max: 0.1 },
      { min: 0.1, max: 0.2 },
      { min: 0.2, max: 0.3 },
      { min: 0.3, max: 0.4 },
      { min: 0.4, max: 0.5 },
      { min: 0.5, max: 0.6 },
      { min: 0.6, max: 0.7422 }
    ];
  
    legendContent.innerHTML = title + Ranges.map(range => {
      const color = ToColorMonth_z_b(range.min);
      return `
        <div>
          <span style="background: ${color}; width: 20px; height: 20px; display: inline-block;"></span> ${range.min.toFixed(1)} - ${range.max.toFixed(1)}
        </div>
      `;
    }).join('');
  
    return legendContent;
  }
  