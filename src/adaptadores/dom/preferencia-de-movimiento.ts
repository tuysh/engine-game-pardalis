// Lee del sistema si la persona pidió «movimiento reducido». Con esa preferencia activa,
// los movimientos de cámara de las cinemáticas se vuelven cortes (docs/DISENO-3.0.md §7.5).

const CONSULTA_DE_MOVIMIENTO_REDUCIDO = '(prefers-reduced-motion: reduce)';

export function leerSiSePrefiereMenosMovimiento(): boolean {
  return window.matchMedia(CONSULTA_DE_MOVIMIENTO_REDUCIDO).matches;
}
