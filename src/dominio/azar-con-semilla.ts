// Un generador de números al azar que siempre da la misma serie para la misma semilla.
// Sirve para que las pruebas (y la opción `semilla` del host) hagan repetible lo que depende del azar.

/**
 * Devuelve una función que, cada vez que se llama, entrega un número mayor o igual a 0 y menor que 1.
 *
 * Es el algoritmo conocido como «mulberry32». No hace falta entender sus operaciones de bits para usarlo:
 * revuelven el número guardado de forma que el siguiente parezca no tener relación con el anterior.
 */
export function crearAzarConSemilla(semilla: number): () => number {
  let numeroGuardado = semilla;

  return (): number => {
    numeroGuardado = (numeroGuardado + 0x6d2b79f5) | 0;
    let revuelto = Math.imul(numeroGuardado ^ (numeroGuardado >>> 15), 1 | numeroGuardado);
    revuelto = (revuelto + Math.imul(revuelto ^ (revuelto >>> 7), 61 | revuelto)) ^ revuelto;
    const enteroDe32Bits = (revuelto ^ (revuelto >>> 14)) >>> 0;
    return enteroDe32Bits / 4_294_967_296; // se divide entre 2 elevado a 32 para que quede entre 0 y 1
  };
}
