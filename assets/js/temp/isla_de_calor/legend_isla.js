// legend_isla.js

export function legend_isla() {
    // Crear el contenedor de la leyenda
    const legendContent = document.createElement('div');
    legendContent.id = 'yearLegend';
    legendContent.style.position = 'absolute';
    legendContent.style.top = '50%';
    legendContent.style.left = '10px'; // Posicionar a la izquierda
    legendContent.style.transform = 'translateY(-50%)';
    legendContent.style.backgroundColor = 'rgba(255, 255, 255, 0.8)';
    legendContent.style.padding = '10px'; // Padding adecuado
    legendContent.style.zIndex = '2';
    legendContent.style.border = '1px solid #ccc'; // Borde para distinguir la leyenda
    legendContent.style.borderRadius = '4px'; // Bordes redondeados opcionales
    legendContent.style.textAlign = 'left'; // Alinear el contenido a la izquierda
    legendContent.style.fontFamily = 'Arial, sans-serif'; // Fuente Arial

    // Título de la leyenda
    const title = document.createElement('div');
    title.textContent = 'Isla de Calor (°C) Anual';
    title.style.fontSize = '12px'; // Tamaño de fuente adecuado
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '5px'; // Espacio entre título y contenido
    legendContent.appendChild(title);
    
  // Subtítulo
  const subtitle = document.createElement('div');
  subtitle.textContent = 'Clase';
  subtitle.style.fontSize = '12px'; // Reducir tamaño de la fuente del subtítulo
  subtitle.style.color = '#555'; // Color gris para diferenciar del título
  subtitle.style.marginBottom = '5px'; // Reducir espacio
  legendContent.appendChild(subtitle);


    // Definir las clases y colores
    const classes = [
        { label: '0: 0-3°C', color: '#FFFFFF' },
        { label: '1: 3-6°C', color: '#FFCCCC' },
        { label: '2: 6-9°C', color: '#FF6666' },
        { label: '3: > 9°C', color: '#FF0000' }
    ];

    // Crear elementos para cada clase
    classes.forEach(cls => {
        const item = document.createElement('div');
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.marginBottom = '5px'; // Espacio entre items

        // Cuadro de color
        const colorBox = document.createElement('span');
        colorBox.style.width = '18px';
        colorBox.style.height = '18px';
        colorBox.style.backgroundColor = cls.color;
        colorBox.style.border = '1px solid #000';
        colorBox.style.marginRight = '8px';
        colorBox.style.display = 'inline-block';
        colorBox.style.borderRadius = '3px'; // Bordes ligeramente redondeados
        item.appendChild(colorBox);

        // Etiqueta de texto
        const label = document.createElement('span');
        label.textContent = cls.label;
        label.style.fontSize = '12px';
        item.appendChild(label);

        // Añadir el item a la leyenda
        legendContent.appendChild(item);
    });

    // Añadir la leyenda al contenedor principal del mapa
    const container = document.getElementById('p71');
    if (container) {
        container.appendChild(legendContent);
    } else {
        console.error("Elemento con ID 'p71' no encontrado. Asegúrate de que existe en tu HTML.");
    }
}
