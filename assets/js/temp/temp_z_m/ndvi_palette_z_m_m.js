export function ToColorMonth_z_m(LST) {

      // Definir los rangos de valores y sus paletas de colores correspondientes
      const ranges = [
        [7, 15],  // Primer rango
        [15, 22],  // Segundo rango
        [22, 31],  // Tercer rango
        [31, 39],  // Cuarto rango
        [39, 44]   // Quinto rango
    ];

    const palettes = [
        ['#040274', '#040281', '#0502a3', '#0502b8', '#0502ce', '#0502e6'], // Paleta para el primer rango
        ['#0602ff', '#235cb1', '#307ef3', '#269db1', '#30c8e2', '#32d3ef'], // Paleta para el segundo rango
        ['#3be285', '#3ff38f', '#86e26f', '#3ae237', '#b5e22e', '#d6e21f'], // Paleta para el tercer rango
        ['#fff705', '#ffd611', '#ffb613', '#ff8b13', '#ff6e08', '#ff500d'], // Paleta para el cuarto rango
        ['#ff0000', '#de0101', '#c21301', '#a71001', '#911003']  // Paleta para el quinto rango
    ];

    let color = '#000000'; // Color por defecto en caso de error

    // Asignar el color basado en el rango
    for (let i = 0; i < ranges.length; i++) {
        if (LST>= ranges[i][0] && LST<= ranges[i][1]) {
            // Normalización del valor dentro del rango específico
            const rangeStart = ranges[i][0];
            const rangeEnd = ranges[i][1];
            const rangePalette = palettes[i];

            const normalizedValue = (LST- rangeStart) / (rangeEnd - rangeStart);

            // Calcular el índice de color correspondiente en la paleta de colores para el rango
            const colorIndex = Math.floor(normalizedValue * (rangePalette.length - 1));
            color = rangePalette[colorIndex];
            break;
        }
    }

    return color;
}
