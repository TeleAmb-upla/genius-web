function valueToSTColor(value) {
const domain = [
    -10, -9, -8, -7, -6, -5, -4, -3, -2, -1, 
     0,  1,  2,  3,  4,  5,  6,  7,  8,  9, 10
];
const range = [
    "#FF0000", "#fb3629", "#FF1E1F", "#FE393A", "#FE5456", "#FD6F72", "#FD8B8D", 
    "#FCA6A9", "#FCC1C5", "#FBDCE0", "#FBF7FC", "#FBF7FC", "#DFDEFC", "#C4C4FD", 
    "#A8ABFD", "#8D92FD", "#7178FE", "#565FFE", "#3A46FE", "#1F2CFF", 
    "#0313FF", "#0000FF"
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
  const response = await fetch('/assets/vec/raster/aod_pixel/AOD_Trend/AOD_Yearly_Trend.tif');
  const arrayBuffer = await response.arrayBuffer();

  // Parsear el georaster
  const georaster = await parseGeoraster(arrayBuffer);

  // Crear la capa de GeoRaster con un color fijo para 2018
  const Layer = new GeoRasterLayer({
      georaster: georaster,
          pixelValuesToColorFn: values => {
          const Value = values[0];
          if (isNaN(Value)) {
              return null; // Retornar null si el valor es NaN
          }
          return valueToSTColor(Value); // Rojo fijo para 2018
      },
      resolution: 1080
  });

  // No agregar la capa al mapa aquí, solo retornarla
  return Layer;
}



export function createSTLegendSVG() {
    const Values = [   -12, -6, -3, 0, 3, 6, 12];

    const legendItems = Values.map((trend, index) => {
        const color = valueToSTColor(trend);
        const yPosition = 25 + index * 30;
        const label = `${Math.round(trend * 100) / 100}`;

        return `
            <rect x="0" y="${yPosition}" width="20" height="20" style="fill:${color}" />
            <text x="25" y="${yPosition + 15}" font-size="12" font-family="Arial">${label}</text>
        `;
    }).join('');

    return `
        <svg width="100" height="220" xmlns="http://www.w3.org/2000/svg">
            <text x="0" y="15" font-size="12" font-family="Arial">Tendencia</text>
            ${legendItems}
        </svg>
    `;
}

