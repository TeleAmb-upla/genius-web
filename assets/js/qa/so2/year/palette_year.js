export function ToColorYear(SO2_Median) {
    const minlst = 18.38;
    const maxlst = 41.76;

    const palette = [
        '040274', '040281', '0502a3', '0502b8', '0502ce', '0502e6',
        '0602ff', '235cb1', '307ef3', '269db1', '30c8e2', '32d3ef',
        '3be285', '3ff38f', '86e26f', '3ae237', 'b5e22e', 'd6e21f',
        'fff705', 'ffd611', 'ffb613', 'ff8b13', 'ff6e08', 'ff500d',
        'ff0000', 'de0101', 'c21301', 'a71001', '911003'
    ];

    // Asegurarse de que el valor esté dentro del rango esperado
    if (SO2_Median < minlst) SO2_Median = minlst;
    if (SO2_Median > maxlst) SO2_Median = maxlst;

    // SOrmalización del valor dentro del rango
    let ratio = (SO2_Median - minlst) / (maxlst - minlst);

    // Calcular el índice de color correspondiente en la paleta
    const colorIndex = Math.floor(ratio * (palette.length - 1));
    const color = palette[colorIndex];

    // Convertir el color hexadecimal a RGB
    const r = parseInt(color.substring(0, 2), 16);
    const g = parseInt(color.substring(2, 4), 16);
    const b = parseInt(color.substring(4, 6), 16);

    return `rgb(${r}, ${g}, ${b})`;
}
