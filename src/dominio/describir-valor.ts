// Dice con palabras qué valor llegó de afuera, para ponerlo en un mensaje de error:
// así quien lee el mensaje ve de inmediato qué escribió mal.

/** Ejemplos: `"casa"`, `42`, `null`, `undefined`, `una lista`, `una función`, `un objeto`. */
export function describirValor(valor: unknown): string {
  if (typeof valor === 'string') return `"${valor}"`;
  if (typeof valor === 'function') return 'una función';
  if (Array.isArray(valor)) return 'una lista';
  if (typeof valor === 'object' && valor !== null) return 'un objeto';
  return String(valor);
}
