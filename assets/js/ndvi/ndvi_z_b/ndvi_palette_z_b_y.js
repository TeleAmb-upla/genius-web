export function ndviToColorYear_z_b(ndvi) {
  
  const minNDVI = 0.1;
  const maxNDVI = 0.4;


  // Paleta de colores invertida que representa los diferentes valores de NDVI
  const palette = ['ff0000', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718',
      '74A901', '529400', '3E8601', '207401', '056201', '004C00', '023B01',
      '012E01', '011D01', '011301'];

  // Asignamos rangos de NDVI a los colores
  const ranges = [
      { min: minNDVI, max: 0.15, color: `#${palette[0]}` },    // Color rojo
      { min: 0.15, max: 0.2, color: `#${palette[3]}` },   // Color amarillo claro
      { min: 0.2, max: 0.25, color: `#${palette[8]}` },    // Color verde claro
      { min: 0.25, max: 0.35, color: `#${palette[11]}` },    // Color verde
      { min: 0.35, max: maxNDVI, color: `#${palette[14]}` }    // Color verde oscuro
  ];


  // Si el NDVI está fuera del rango, devolvemos el color mínimo o máximo
  if (ndvi <= minNDVI) {
      return ranges[0].color;
  }
  if (ndvi >= maxNDVI) {
      return ranges[ranges.length - 1].color;
  }

  // Asignar color basado en el rango al que pertenece el valor de NDVI
  for (let i = 0; i < ranges.length; i++) {
      if (ndvi >= ranges[i].min && ndvi < ranges[i].max) {
          return ranges[i].color;
      }
  }

  // Retorna el color correspondiente al NDVI si no entra en ningún rango (caso extraño)
  return ranges[0].color; // Fallback al color mínimo
}
