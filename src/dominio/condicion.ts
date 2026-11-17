// Las condiciones de un nivel: preguntas sobre el estado que deciden, por ejemplo,
// qué rama de un diálogo se usa o si la salida ya está abierta.
// Son datos, nunca código: no se evalúa JavaScript escrito en un nivel.
//
// Cómo se escriben en un nivel            Qué significan
//   "tengo tortillas"                      la variable "tortillas" tiene un valor verdadero
//   "globo"                                lo mismo: "tengo" es opcional y solo ayuda a leer
//   "no tengo limones"                     negación; "no" va delante de cualquier condición
//   "objetivosCompletos"                   ya se cumplieron todos los objetivos del nivel
//   "charlas.tortu"                        ya se habló con "tortu" (el motor lo marca solo)
//   ["a", "b"]                             se cumplen "a" Y "b"
//   { "alguno": ["a", "b"] }               se cumple "a" O "b"

import { estanCompletosLosObjetivos, tieneValor } from './estado.ts';
import type { EstadoDeNivel } from './estado.ts';

/** Una condición ya leída, lista para evaluarse. */
export type Condicion =
  | { readonly tipo: 'variable'; readonly nombre: string }
  | { readonly tipo: 'objetivosCompletos' }
  | { readonly tipo: 'no'; readonly condicion: Condicion }
  | { readonly tipo: 'todas'; readonly condiciones: readonly Condicion[] }
  | { readonly tipo: 'alguna'; readonly condiciones: readonly Condicion[] };

const PREFIJO_DE_NEGACION = 'no ';
const PREFIJO_TENGO = 'tengo ';
const TODOS_LOS_OBJETIVOS = 'objetivosCompletos';

// Uno o más espacios, tabuladores o saltos de línea seguidos.
// Ejemplo: en "tengo   tortillas" encuentra los tres espacios juntos.
const ESPACIOS_SEGUIDOS = /\s+/g;

/**
 * Convierte el texto de una condición en una `Condicion`.
 * Ejemplo: `'no tengo limones'` → `{ tipo: 'no', condicion: { tipo: 'variable', nombre: 'limones' } }`.
 *
 * No revisa que la variable exista: eso lo hace la validación del nivel.
 */
export function leerCondicionDeTexto(texto: string): Condicion {
  const textoLimpio = texto.trim().replace(ESPACIOS_SEGUIDOS, ' ');

  if (textoLimpio.startsWith(PREFIJO_DE_NEGACION)) {
    const loQueSeNiega = textoLimpio.slice(PREFIJO_DE_NEGACION.length);
    return { tipo: 'no', condicion: leerCondicionDeTexto(loQueSeNiega) };
  }
  if (textoLimpio === TODOS_LOS_OBJETIVOS) {
    return { tipo: 'objetivosCompletos' };
  }
  if (textoLimpio.startsWith(PREFIJO_TENGO)) {
    return { tipo: 'variable', nombre: textoLimpio.slice(PREFIJO_TENGO.length) };
  }
  return { tipo: 'variable', nombre: textoLimpio };
}

/** Dice si la condición se cumple en ese estado. */
export function cumpleCondicion(condicion: Condicion, estado: EstadoDeNivel): boolean {
  switch (condicion.tipo) {
    case 'variable':
      return tieneValor(estado, condicion.nombre);
    case 'objetivosCompletos':
      return estanCompletosLosObjetivos(estado);
    case 'no':
      return !cumpleCondicion(condicion.condicion, estado);
    case 'todas':
      return condicion.condiciones.every((parte) => cumpleCondicion(parte, estado));
    case 'alguna':
      return condicion.condiciones.some((parte) => cumpleCondicion(parte, estado));
  }
}

/** Los nombres de las variables que menciona una condición. Sirve para revisar que estén declaradas. */
export function variablesQueUsa(condicion: Condicion): string[] {
  switch (condicion.tipo) {
    case 'variable':
      return [condicion.nombre];
    case 'objetivosCompletos':
      return [];
    case 'no':
      return variablesQueUsa(condicion.condicion);
    case 'todas':
    case 'alguna': {
      const nombres: string[] = [];
      for (const parte of condicion.condiciones) {
        nombres.push(...variablesQueUsa(parte));
      }
      return nombres;
    }
  }
}
