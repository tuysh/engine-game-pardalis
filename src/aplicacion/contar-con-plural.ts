// Escribe una cantidad con su sustantivo en singular o plural, como se dice en español.

/**
 * Ejemplos: `contarConPlural(1, 'error', 'errores')` → `'1 error'`;
 * `contarConPlural(0, 'error', 'errores')` → `'0 errores'`.
 */
export function contarConPlural(cantidad: number, singular: string, plural: string): string {
  if (cantidad === 1) return `1 ${singular}`;
  return `${cantidad} ${plural}`;
}
