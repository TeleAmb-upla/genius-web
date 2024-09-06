export function ndviToColorYear_z_b(ndvi) {
  
    const minNDVI = -0.3359;
    const maxNDVI = 0.7422;
  
    // Asegurarse de que el valor NDVI esté dentro del rango esperado
    if (ndvi < minNDVI) ndvi = minNDVI;
    if (ndvi > maxNDVI) ndvi = maxNDVI;
  
    // Mapeo de NDVI a color
    let ratio = (ndvi - minNDVI) / (maxNDVI - minNDVI);
    let r = 0, g = 0, b = 0;
  
    if (ratio <= 0.5) {
      // De rojo a amarillo
      ratio *= 2;
      r = 255;
      g = Math.round(255 * ratio);
    } else {
      // De amarillo a verde
      ratio = (ratio - 0.5) * 2;
      r = Math.round(255 * (1 - ratio));
      g = 255;
    }
  
    return `rgb(${r}, ${g}, ${b})`;
  }
  