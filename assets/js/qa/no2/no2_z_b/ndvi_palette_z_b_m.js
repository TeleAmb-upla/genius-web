export function ToColorMonth_z_b(OAD) {
    const min = 0.14;
    const max = 0.25;


    // Asegurarse de que el valor NDVI esté dentro del rango esperado
    if (OAD < min) OAD = min;
    if (OAD > max) OAD = max;

    // Mapeo de NDVI a color
    let ratio = (OAD - min) / (max - min);
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