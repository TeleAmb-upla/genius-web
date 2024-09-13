import { ToColorYear_z_m } from './ndvi_palette_z_m_y.js'; 
import { ToColorMonth_z_m } from './ndvi_palette_z_m_m.js';

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
  title.textContent = 'LST ANUAL';
  title.style.fontSize = '14px';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '5px';
  legendContent.appendChild(title);

  // Subtítulo
  const subtitle = document.createElement('div');
  subtitle.textContent = 'Temperatura superficial terrestre (°C)';
  subtitle.style.fontSize = '12px';
  subtitle.style.color = '#555'; // Color gris para diferenciar del título
  subtitle.style.marginBottom = '10px';
  legendContent.appendChild(subtitle);

  // Rangos de valores para la leyenda
  const Ranges = [
      { min: 16, max: 23 },
      { min: 23, max: 28 },
      { min: 28, max: 33 },
      { min: 33, max: 38 },
      { min: 38, max: 42 }
  ];

  // Crear el contenido de la leyenda en HTML con rangos
  Ranges.forEach((range) => {
      const color = ToColorYear_z_m(range.min); // Obtener el color basado en el valor

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
      label.textContent = `${range.min.toFixed(1)}°C - ${range.max.toFixed(1)}°C`; // Mostrar el rango

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
  title.textContent = 'LST MENSUAL';
  title.style.fontSize = '14px';
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '5px';
  legendContent.appendChild(title);

  // Subtítulo
  const subtitle = document.createElement('div');
  subtitle.textContent = 'Temperatura superficial terrestre (°C)';
  subtitle.style.fontSize = '12px';
  subtitle.style.color = '#555'; // Color gris para diferenciar del título
  subtitle.style.marginBottom = '10px';
  legendContent.appendChild(subtitle);

  // Rangos de valores para la leyenda
  const Ranges = [
      { min: 7, max: 15 },
      { min: 15, max: 22 },
      { min: 22, max: 31 },
      { min: 31, max: 39 },
      { min: 39, max: 44 }
  ];

  // Crear el contenido de la leyenda en HTML con rangos
  Ranges.forEach((range) => {
      const color = ToColorMonth_z_m(range.min); // Obtener el color basado en el valor

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
      label.textContent = `${range.min.toFixed(1)}°C - ${range.max.toFixed(1)}°C`; // Mostrar el rango

      legendItem.appendChild(colorBox);
      legendItem.appendChild(label);
      legendContent.appendChild(legendItem);
  });

  return legendContent;
}

