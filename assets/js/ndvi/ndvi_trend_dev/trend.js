function valueToSTColor(value) {
    // Definir los colores de la paleta
    const domain = [
        -0.3, -0.05, -0.002, 0, 0.002, 0.05, 0.3
    ];
    const range = [
        "#ff0000", // Rojo intenso para los valores negativos bajos
        "#ff3d66", // Rojo medio para valores negativos moderados
        "#ff75ad", // Rojo suave para valores negativos más cercanos a 0
        "#ffffff", // Blanco para el valor 0
        "#75aaff", // Azul claro para valores positivos bajos
        "#4d66ff", // Azul medio para valores positivos moderados
        "#0313ff"  // Azul intenso para valores positivos altos
    ];

    for (let i = 0; i < domain.length; i++) {
        if (value <= domain[i]) {
            return range[i];
        }
    }
    return range[range.length - 1];
}


export async function map_trend(map) {
  // Leer el archivo  
  const response = await fetch('/assets/vec/raster/NDVI_pixel/NDVI_Trend/NDVI_Yearly_Trend.tif');
  const arrayBuffer = await response.arrayBuffer();

  // Parsear el georaster
  const georaster = await parseGeoraster(arrayBuffer);

  // Crear la capa de GeoRaster con la nueva lógica de colores
  const Layer = new GeoRasterLayer({
      georaster: georaster,
        pixelValuesToColorFn: values => {
          const Value = values[0];
          if (isNaN(Value)) {
              return null; // Retornar null si el valor es NaN
          }
          return valueToSTColor(Value); // Aplicar la función de colores según el valor
      },
      resolution: 1080
  });

  // No agregar la capa al mapa aquí, solo retornarla
  return Layer;
}


export function createSTLegendSVG() {
    // Definir los nuevos rangos de valores con colores en formato hexadecimal
    const ranges = [
        { min: -0.06, max: -0.03, color: '#FF0000' },  // Rojo fuerte
        { min: -0.03, max: 0, color: '#FF6666' },      // Degradado rojo a blanco
        { min: 0, max: 0, color: '#FFFFFF' },          // Blanco puro (cero)
        { min: 0, max: 0.03, color: '#99CCFF' },       // Degradado blanco a azul claro
        { min: 0.03, max: 0.06, color: '#0000FF' }     // Azul fuerte
    ];

    // Crear los elementos de la leyenda
    const legendItems = ranges.map((range, index) => {
        const color = range.color;
        const yPosition = 25 + index * 30;
        const label = range.min === range.max 
            ? `${range.min.toFixed(2)}` // Si es 0 exacto, solo mostramos "0"
            : `${range.min.toFixed(2)} - ${range.max.toFixed(2)}`; // Rango con dos valores

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join(''); // Unir todos los elementos de la leyenda

    // Devolver el SVG completo
    return `
        <svg width="150" height="${50 + ranges.length * 30}" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="14" font-family="Arial" font-weight="bold">Tendencia NDVI</text>
            ${legendItems}
        </svg>
    `;
}


