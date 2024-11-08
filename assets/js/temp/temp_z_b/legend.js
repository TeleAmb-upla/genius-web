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
  legendContent.style.padding = '5px'; // Reducir padding
  legendContent.style.zIndex = '2';
  legendContent.style.border = '1px solid #ccc'; // Añadir un borde
  legendContent.style.textAlign = 'left'; // Alinear el contenido a la izquierda
  legendContent.style.fontFamily = 'Arial, sans-serif'; // Usar fuente Arial

  // Título "Temperatura Superficial"
  const title = document.createElement('div');
  title.textContent = 'Temperatura Superficial';
  title.style.fontSize = '12px'; // Reducir tamaño de la fuente
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '3px'; // Reducir espacio entre título y subtítulo
  legendContent.appendChild(title);

  // Subtítulo
  const subtitle = document.createElement('div');
  subtitle.textContent = 'LST (°C) Anual';
  subtitle.style.fontSize = '10px'; // Reducir tamaño de la fuente del subtítulo
  subtitle.style.color = '#555'; // Color gris para diferenciar del título
  subtitle.style.marginBottom = '5px'; // Reducir espacio
  legendContent.appendChild(subtitle);

// Dominio de valores para la leyenda (valores de temperatura)
const values = [
  "<19°", "19° - 20°", "20° - 21°", "21° - 22°", "22° - 23°",
  "23° - 24°", "24° - 25°", "25° - 26°", "26° - 27°", "27° - 28°",
  "28° - 29°", "29° - 30°", "30° - 31°", "31° - 32°", "32° - 33°",
  "33° - 34°", "34° - 35°", ">35°"
];

// Colores correspondientes para cada valor (18 colores)
const colors = [
  "#00008B", "#0000FF", "#1E90FF", "#00BFFF", "#00FFFF",
  "#7FFF00", "#32CD32", "#ADFF2F", "#FFFF00", "#FFD700",
  "#FFA500", "#FF8C00", "#FF4500", "#FF0000", "#DC143C",
  "#B22222", "#8B0000", "#800000"
];


  // Crear el contenido de la leyenda en HTML con rangos
  values.forEach((value, index) => {
    const color = colors[index]; // Obtener el color correspondiente

    const legendItem = document.createElement('div');
    legendItem.style.marginBottom = '2px'; // Reducir el espacio entre elementos
    legendItem.style.display = 'flex'; // Usar flexbox para alinear horizontalmente
    legendItem.style.alignItems = 'center'; // Alinear verticalmente al centro

    const colorBox = document.createElement('span');
    colorBox.style.background = color;
    colorBox.style.width = '15px'; // Reducir tamaño del cuadro de color
    colorBox.style.height = '15px'; // Reducir tamaño del cuadro de color
    colorBox.style.display = 'inline-block';
    colorBox.style.marginRight = '8px'; // Reducir espacio entre cuadro y texto
    colorBox.style.border = '0.5px solid black'; // Agregar borde negro de 0.5px

    const label = document.createElement('span');
    label.style.fontSize = '10px'; // Reducir tamaño de la fuente del texto
    label.textContent = value; // Mostrar el rango de temperatura

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
  legendContent.style.padding = '5px'; // Reducir padding
  legendContent.style.zIndex = '2';
  legendContent.style.border = '1px solid #ccc'; // Añadir un borde
  legendContent.style.textAlign = 'left'; // Alinear el contenido a la izquierda
  legendContent.style.fontFamily = 'Arial, sans-serif'; // Usar fuente Arial

  // Título "Temperatura Superficial"
  const title = document.createElement('div');
  title.textContent = 'Temperatura Superficial';
  title.style.fontSize = '12px'; // Reducir tamaño de la fuente
  title.style.fontWeight = 'bold';
  title.style.marginBottom = '3px'; // Reducir espacio entre título y subtítulo
  legendContent.appendChild(title);

  // Subtítulo
  const subtitle = document.createElement('div');
  subtitle.textContent = 'LST (°C) Mensual';
  subtitle.style.fontSize = '10px'; // Reducir tamaño de la fuente del subtítulo
  subtitle.style.color = '#555'; // Color gris para diferenciar del título
  subtitle.style.marginBottom = '5px'; // Reducir espacio
  legendContent.appendChild(subtitle);

  // Dominio de valores para la leyenda (valores de temperatura)
  const domain = [13, 42]; // Min y Max
  const steps = 18; // Número de rangos (mismo que en la leyenda anual)
  const stepValue = (domain[1] - domain[0]) / (steps - 1); // Calcular los intervalos

  // Colores correspondientes para cada valor (idénticos a los de la leyenda anual)
  const colors = [
    "#00008B", "#0000FF", "#1E90FF", "#00BFFF", "#00FFFF",
    "#7FFF00", "#32CD32", "#ADFF2F", "#FFFF00", "#FFD700",
    "#FFA500", "#FF8C00", "#FF4500", "#FF0000", "#DC143C", 
    "#B22222", "#8B0000", "#800000"
  ];

  // Generar los valores para la leyenda
  const values = Array.from({ length: steps }, (_, i) => domain[0] + i * stepValue);

  // Crear el contenido de la leyenda en HTML con rangos
  values.forEach((value, index) => {
    const color = colors[index]; // Obtener el color correspondiente

    const legendItem = document.createElement('div');
    legendItem.style.marginBottom = '2px'; // Reducir el espacio entre elementos
    legendItem.style.display = 'flex'; // Usar flexbox para alinear horizontalmente
    legendItem.style.alignItems = 'center'; // Alinear verticalmente al centro

    const colorBox = document.createElement('span');
    colorBox.style.background = color;
    colorBox.style.width = '15px'; // Reducir tamaño del cuadro de color
    colorBox.style.height = '15px'; // Reducir tamaño del cuadro de color
    colorBox.style.display = 'inline-block';
    colorBox.style.marginRight = '8px'; // Reducir espacio entre cuadro y texto
    colorBox.style.border = '0.5px solid black'; // Agregar borde negro de 0.5px

    const label = document.createElement('span');
    label.style.fontSize = '10px'; // Reducir tamaño de la fuente del texto

    // Agregar los rangos "<11°" y ">40°"
    if (index === 0) {
      label.textContent = `<11°`; // Rango menor que el valor mínimo
    } else if (index === values.length - 1) {
      label.textContent = `>40°`; // Rango mayor que el valor máximo
    } else {
      const nextValue = values[index + 1]; // Próximo valor para calcular el rango
      label.textContent = `${value.toFixed(0)}° - ${nextValue.toFixed(0)}°`; // Mostrar el rango de temperatura
    }

    legendItem.appendChild(colorBox);
    legendItem.appendChild(label);

    legendContent.appendChild(legendItem);
  });

  return legendContent;
}
