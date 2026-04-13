import { ToColorYear_z_b } from './ndvi_palette_z_b_y.js'; 
import { ToColorMonth_z_b } from './ndvi_palette_z_b_m.js';
export function createYearLegend() {
  const legendContent = document.createElement('div');
  legendContent.id = 'yearLegend';
  legendContent.className = 'map-legend-panel';

  // Agregar título 
  const title = document.createElement('div');
  title.textContent = 'Dióxido de Azufre Anual';
  title.className = 'map-legend-panel__title';
  legendContent.appendChild(title);

  // Agregar subtítulo con subíndice
  const subtitle = document.createElement('div');
  subtitle.innerHTML = 'SO<sub>2</sub> (µmol/m²)'; // Usar innerHTML para incluir el subíndice
  subtitle.className = 'map-legend-panel__subtitle';
  legendContent.appendChild(subtitle);
  
  // Dominio de valores para la leyenda
  const domain =  [82,322]; // O rangos
  const steps = 7; // Dividimos en 6 partes
  const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular paso entre valores

  
  const colors =   ["#335B01", "#C3E934", "#FFE733", "#FFA500", "#FF4500", "#8B0000"];

  // Generar los valores para la leyenda
  const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);


  // Crear el contenido de la leyenda en HTML con rangos
  Values.forEach((value, index) => {
    if (index === Values.length - 1) return; // No mostrar para el último valor (sin rango)

    const nextValue = Values[index + 1]; // Próximo valor para calcular el rango
    const color = colors[index]; // Obtener el color basado en el valor


    const legendItem = document.createElement('div');
    legendItem.className = 'map-legend-panel__row';

    const colorBox = document.createElement('span');
    colorBox.className = 'map-legend-panel__swatch';
    colorBox.style.background = color;

    const label = document.createElement('span');
    label.className = 'map-legend-panel__label';
    label.textContent = `${value.toFixed(0)} - ${nextValue.toFixed(0)}`; // Mostrar el rango

    legendItem.appendChild(colorBox);
    legendItem.appendChild(label);

    legendContent.appendChild(legendItem);
  });

  return legendContent; // Esto estaba faltando
}


export function createMonthLegend() {
  const legendContent = document.createElement('div');
  legendContent.id = 'monthLegend';
  legendContent.className = 'map-legend-panel';

  // Agregar título "AOD Mensual"
  const title = document.createElement('div');
  title.textContent = 'Dióxido de Azufre Mensual'; 
  title.className = 'map-legend-panel__title';
  legendContent.appendChild(title);

    // Agregar subtítulo con subíndice
    const subtitle = document.createElement('div');
    subtitle.innerHTML = 'SO<sub>2</sub> (µmol/m²)'; // Usar innerHTML para incluir el subíndice
    subtitle.style.fontSize = '12px';
    subtitle.style.color = '#555'; // Color gris para diferenciar del título
    subtitle.style.marginBottom = '10px';
    legendContent.appendChild(subtitle);

  // Dominio de valores para la leyenda
  const domain = [ 0,2768];
  const steps = 7; // Dividimos en 6 partes
  const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular paso entre valores

  
  const colors = ["#335B01", "#C3E934", "#FFE733", "#FFA500", "#FF4500", "#8B0000"];

  // Generar los valores para la leyenda
  const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);


  // Crear el contenido de la leyenda en HTML con rangos
  Values.forEach((value, index) => {
    if (index === Values.length - 1) return; // No mostrar para el último valor (sin rango)

    const nextValue = Values[index + 1]; // Próximo valor para calcular el rango
    const color = colors[index]; // Obtener el color basado en el valor

    const legendItem = document.createElement('div');
    legendItem.className = 'map-legend-panel__row';

    const colorBox = document.createElement('span');
    colorBox.className = 'map-legend-panel__swatch';
    colorBox.style.background = color;

    const label = document.createElement('span');
    label.className = 'map-legend-panel__label';
    label.textContent = `${value.toFixed(0)} - ${nextValue.toFixed(0)}`; // Mostrar el rango

    legendItem.appendChild(colorBox);
    legendItem.appendChild(label);

    legendContent.appendChild(legendItem);
});

return legendContent;
}
