import { ToColorYear_z_m } from './ndvi_palette_z_m_y.js'; 
import { ToColorMonth_z_m } from './ndvi_palette_z_m_m.js';

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
    
    const title = '<h5>LST ANUAL</h5>';
    const Ranges = [
      { min: 16, max: 23 },
      { min: 23, max: 28 },
      { min: 28, max: 33 },
      { min: 33, max: 38 },
      { min: 38, max: 42 }
    ];
  
    legendContent.innerHTML = title + Ranges.map(range => {
      const color = ToColorYear_z_m(range.min);
      return `
        <div>
          <span style="background: ${color}; width: 20px; height: 20px; display: inline-block;"></span> 
          ${range.min.toFixed(1)}°C - ${range.max.toFixed(1)}°C  <!-- Agregar °C aquí -->
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
    
    const title = '<h5>LST MENSUAL</h5>';
    const Ranges = [
      { min: 7, max: 15 },
      { min: 15, max: 22 },
      { min: 22, max: 31 },
      { min: 31, max: 39 },
      { min: 39, max: 44 }
    ];
  
    legendContent.innerHTML = title + Ranges.map(range => {
      const color = ToColorMonth_z_m(range.min);
      return `
        <div>
          <span style="background: ${color}; width: 20px; height: 20px; display: inline-block;"></span> 
          ${range.min.toFixed(1)}°C - ${range.max.toFixed(1)}°C <!-- Agregar °C aquí -->
        </div>
      `;
    }).join('');
  
    return legendContent;
}
