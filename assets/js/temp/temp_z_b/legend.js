import { ToColorYear_z_b } from './ndvi_palette_z_b_y.js'; //../ndvi_z_b_y/ndvi_palette.js
import { ToColorMonth_z_b } from './ndvi_palette_z_b_m.js';
// Leyenda Anual
export function createYearLegend() {
  const legendContent = document.createElement('div');
  legendContent.id = 'yearLegend';
  legendContent.style.position = 'absolute';
  legendContent.style.top = '50%';
  legendContent.style.left = '10px'; // Colocar a la izquierda
  legendContent.style.transform = 'translateY(-50%)';
  legendContent.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
  legendContent.style.padding = '10px';
  legendContent.style.zIndex = '2';
  legendContent.style.border = '1px solid #ccc'; // Añadir un borde
  legendContent.style.textAlign = 'left'; // Alinear el contenido a la izquierda

  // Título "LST ANUAL"
  const title = document.createElement('div');
  title.textContent = 'Temperatura superficial terrestre';
  title.style.fontSize = '14px';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '5px';
  legendContent.appendChild(title);

  // Subtítulo
  const subtitle = document.createElement('div');
  subtitle.textContent = 'LST(°C) Anual';
  subtitle.style.fontSize = '12px';
  subtitle.style.color = '#555'; // Color gris para diferenciar del título
  subtitle.style.marginBottom = '10px';
  legendContent.appendChild(subtitle);

// Dominio de valores para la leyenda
const domain = [25.063,36.313]; // Mínimo y máximo 25.063,36.313

const steps = 7; // Dividimos en 6 partes
const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular paso entre valores

// Colores fijos para cada parte de la leyenda
const colors =  ["#00008B", "#00BFFF", "#32CD32", "#FFFF00", "#FFA500", "#FF4500"];

// Generar los valores para la leyenda
const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

  // Crear el contenido de la leyenda en HTML con rangos
  Values.forEach((value, index) => {
    if (index === Values.length - 1) return; // No mostrar para el último valor (sin rango)

    const nextValue = Values[index + 1]; // Próximo valor para calcular el rango
    const color =  colors[index];  // Obtener el color basado en el valor

    const legendItem = document.createElement('div');
    legendItem.style.marginBottom = '5px';
    legendItem.style.display = 'flex'; // Usar flexbox para alinear horizontalmente
    legendItem.style.alignItems = 'center'; // Alinear verticalmente al centro

    const colorBox = document.createElement('span');
    colorBox.style.background = color;
    colorBox.style.width = '20px';
    colorBox.style.height = '20px';
    colorBox.style.display = 'inline-block';
    colorBox.style.marginRight = '10px';

    const label = document.createElement('span');
    label.textContent = `${value.toFixed(2)}°C - ${nextValue.toFixed(2)}°C`; // Mostrar el rango

    legendItem.appendChild(colorBox);
    legendItem.appendChild(label);

    legendContent.appendChild(legendItem);
});

return legendContent;
}

// Leyenda Mensual
export function createMonthLegend() {
  const legendContent = document.createElement('div');
  legendContent.id = 'monthLegend';
  legendContent.style.position = 'absolute';
  legendContent.style.top = '50%';
  legendContent.style.left = '10px'; // Colocar a la izquierda
  legendContent.style.transform = 'translateY(-50%)';
  legendContent.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
  legendContent.style.padding = '10px';
  legendContent.style.zIndex = '2';
  legendContent.style.border = '1px solid #ccc'; // Añadir un borde
  legendContent.style.textAlign = 'left'; // Alinear el contenido a la izquierda

  // Título "LST MENSUAL"
  const title = document.createElement('div');
  title.textContent = 'Temperatura superficial terrestre';
  title.style.fontSize = '14px';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '5px';
  legendContent.appendChild(title);

  // Subtítulo
  const subtitle = document.createElement('div');
  subtitle.textContent = 'LST(°C) Mensual';
  subtitle.style.fontSize = '12px';
  subtitle.style.color = '#555'; // Color gris para diferenciar del título
  subtitle.style.marginBottom = '10px';
  legendContent.appendChild(subtitle);

  // Dominio de valores para la leyenda
  const domain = [11.13,40.13]; // Mínimo y máximo
  const steps = 7; // Dividimos en 6 partes
  const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular paso entre valores
  
  // Colores fijos para cada parte de la leyenda
  const colors =  ["#00008B", "#00BFFF", "#32CD32", "#FFFF00", "#FFA500", "#FF4500"];
  
  // Generar los valores para la leyenda
  const Values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);
  
    // Crear el contenido de la leyenda en HTML con rangos
    Values.forEach((value, index) => {
      if (index === Values.length - 1) return; // No mostrar para el último valor (sin rango)
  
      const nextValue = Values[index + 1]; // Próximo valor para calcular el rango
      const color =  colors[index];  // Obtener el color basado en el valor
  
      const legendItem = document.createElement('div');
      legendItem.style.marginBottom = '5px';
      legendItem.style.display = 'flex'; // Usar flexbox para alinear horizontalmente
      legendItem.style.alignItems = 'center'; // Alinear verticalmente al centro
  
      const colorBox = document.createElement('span');
      colorBox.style.background = color;
      colorBox.style.width = '20px';
      colorBox.style.height = '20px';
      colorBox.style.display = 'inline-block';
      colorBox.style.marginRight = '10px';
  
      const label = document.createElement('span');
      label.textContent = `${value.toFixed(2)}°C - ${nextValue.toFixed(2)}°C`; // Mostrar el rango
  
      legendItem.appendChild(colorBox);
      legendItem.appendChild(label);
  
      legendContent.appendChild(legendItem);
  });
  
  return legendContent;
  }
  