import { ToColorYear_z_b } from './ndvi_palette_z_b_y.js'; 
import { ToColorMonth_z_b } from './ndvi_palette_z_b_m.js';
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

  // Agregar título 
  const title = document.createElement('div');
  title.textContent = 'Dióxido de Azufre Anual';
  title.style.fontSize = '14px';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '5px';
  legendContent.appendChild(title);

  // Agregar subtítulo con subíndice
  const subtitle = document.createElement('div');
  subtitle.innerHTML = 'SO<sub>2</sub> (µmol/m²)'; // Usar innerHTML para incluir el subíndice
  subtitle.style.fontSize = '12px';
  subtitle.style.color = '#555'; // Color gris para diferenciar del título
  subtitle.style.marginBottom = '10px';
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
  legendContent.style.position = 'absolute';
  legendContent.style.top = '50%';
  legendContent.style.left = '10px'; // Colocar a la izquierda
  legendContent.style.transform = 'translateY(-50%)';
  legendContent.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
  legendContent.style.padding = '10px';
  legendContent.style.zIndex = '2';
  legendContent.style.border = '1px solid #ccc'; // Añadir un borde
  legendContent.style.textAlign = 'left'; // Alinear el contenido a la izquierda

  // Agregar título "AOD Mensual"
  const title = document.createElement('div');
  title.textContent = 'Dióxido de Azufre Mensual'; 
  title.style.fontSize = '14px';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '5px';
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
    label.textContent = `${value.toFixed(0)} - ${nextValue.toFixed(0)}`; // Mostrar el rango

    legendItem.appendChild(colorBox);
    legendItem.appendChild(label);

    legendContent.appendChild(legendItem);
});

return legendContent;
}
