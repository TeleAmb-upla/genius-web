/**
 * SO2 en GeoJSON puede venir en mol/m² (valores |v| < 1) o ya en µmol/m² tras export GEE.
 * Unifica a µmol/m² para paletas y popups, alineado con la leyenda.
 */
export function so2UmolForDisplay(v) {
    if (v == null || v === '') return null;
    const n = Number(v);
    if (Number.isNaN(n)) return null;
    return Math.abs(n) < 1 ? n * 1e6 : n;
}
