// Si un nombre con artículo es singular o plural, para que un verbo concuerde con él:
// «falta el maíz», pero «faltan las tortillas».
//
// Se decide solo por la primera palabra, que en `estado.lista` es el artículo: «el maíz» es singular,
// «las tortillas» es plural. Un nombre que no empieza con una de esas palabras no se adivina.

/** Si un nombre es de una sola cosa o de varias. */
export type NumeroGramatical = 'singular' | 'plural';

/** Artículos y posesivos que dicen que el nombre es de una sola cosa: «el maíz», «tu mochila». */
export const PALABRAS_DE_SINGULAR: readonly string[] = ['el', 'la', 'lo', 'un', 'una', 'mi', 'tu', 'su'];

/** Artículos y posesivos que dicen que el nombre es de varias cosas: «las tortillas», «tus libros». */
export const PALABRAS_DE_PLURAL: readonly string[] = ['los', 'las', 'unos', 'unas', 'mis', 'tus', 'sus'];

// Uno o más espacios seguidos, para separar las palabras. En "el  maíz" encuentra los dos espacios.
const ESPACIOS = /\s+/;

/**
 * El número gramatical de un nombre, según la palabra con la que empieza.
 * Ejemplo: `'el maíz'` → `'singular'`, `'Las tortillas'` → `'plural'`, `'pan'` → `undefined` (no se sabe).
 */
export function numeroGramaticalDe(nombre: string): NumeroGramatical | undefined {
  const primeraPalabra = nombre.trim().split(ESPACIOS)[0]!.toLowerCase(); // `split` siempre da al menos un trozo
  if (PALABRAS_DE_SINGULAR.includes(primeraPalabra)) return 'singular';
  if (PALABRAS_DE_PLURAL.includes(primeraPalabra)) return 'plural';
  return undefined;
}
