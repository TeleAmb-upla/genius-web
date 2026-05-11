import { ToColorYear_z_b } from './ndvi_palette_z_b_y.js'; 
import { ToColorMonth_z_b } from './ndvi_palette_z_b_m.js';
import { legendDomain } from '../../../legend_ranges.js';

export function createYearLegend() {
  const legendContent = document.createElement('div');
  legendContent.id = 'yearLegend';
  legendContent.className = 'map-legend-panel';

  // Agregar título "Profundidad Óptica de Aerosoles"
  const title = document.createElement('div');
  title.textContent = 'Profundidad Óptica de Aerosoles';
  title.className = 'map-legend-panel__title';
  legendContent.appendChild(title);

  // Agregar subtítulo
  const subtitle = document.createElement('div');
  subtitle.textContent = 'AOD Anual';
  subtitle.className = 'map-legend-panel__subtitle';
  legendContent.appendChild(subtitle);

  // Dominio de valores para la leyenda
  const domain = legendDomain('aod', 'zonalBarrio', 'yearly');

  const steps = 7; // Dividimos en 6 partes
  const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular paso entre valores

// Colores fijos para cada parte de la leyenda
const colors = ["#00008B", "#4B0082", "#8A2BE2", "#DA70D6", "#FF69B4", "#FFC0CB"].reverse(); 

// Generar los valores para la leyenda
const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

// Crear el contenido de la leyenda en HTML con rangos
Values.forEach((value, index) => {
    if (index === Values.length - 1) return; // No mostrar para el último valor (sin rango)

    const nextValue = Values[index + 1]; // Próximo valor para calcular el rango
    const color = colors[index]; // Obtener el color basado en el índice

    const legendItem = document.createElement('div');
    legendItem.className = 'map-legend-panel__row';

    const colorBox = document.createElement('span');
    colorBox.className = 'map-legend-panel__swatch';
    colorBox.style.background = color;

    const label = document.createElement('span');
    label.className = 'map-legend-panel__label';
    label.textContent = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`; // Mostrar el rango

    legendItem.appendChild(colorBox);
    legendItem.appendChild(label);

    legendContent.appendChild(legendItem);
});

return legendContent;
}

export function createMonthLegend() {
  const legendContent = document.createElement('div');
  legendContent.id = 'monthLegend';
  legendContent.className = 'map-legend-panel';

  // Agregar título "Profundidad Óptica de Aerosoles"
  const title = document.createElement('div');
  title.textContent = 'Profundidad Óptica de Aerosoles';
  title.className = 'map-legend-panel__title';
  legendContent.appendChild(title);

  // Agregar subtítulo
  const subtitle = document.createElement('div');
  subtitle.textContent = 'AOD Mensual';
  subtitle.className = 'map-legend-panel__subtitle';
  legendContent.appendChild(subtitle);

  // Dominio de valores para la leyenda  79	199

  const domain = legendDomain('aod', 'zonalBarrio', 'monthly');
  const steps = 7; // Dividimos en 6 partes
  const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular paso entre valores


// Colores fijos para cada parte de la leyenda
const colors = ["#00008B", "#4B0082", "#8A2BE2", "#DA70D6", "#FF69B4", "#FFC0CB"].reverse(); 

// Generar los valores para la leyenda
const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

// Crear el contenido de la leyenda en HTML con rangos
Values.forEach((value, index) => {
    if (index === Values.length - 1) return; // No mostrar para el último valor (sin rango)

    const nextValue = Values[index + 1]; // Próximo valor para calcular el rango
    const color = colors[index]; // Obtener el color basado en el índice

    const legendItem = document.createElement('div');
    legendItem.className = 'map-legend-panel__row';

    const colorBox = document.createElement('span');
    colorBox.className = 'map-legend-panel__swatch';
    colorBox.style.background = color;

    const label = document.createElement('span');
    label.className = 'map-legend-panel__label';
    label.textContent = `${value.toFixed(2)} - ${nextValue.toFixed(2)}`; // Mostrar el rango

    legendItem.appendChild(colorBox);
    legendItem.appendChild(label);

    legendContent.appendChild(legendItem);
});

return legendContent;
}
