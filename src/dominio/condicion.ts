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
//   "dinero >= 10"                         el número de "dinero" es 10 o más; también >, <, <= y =
//   ["a", "b"]                             se cumplen "a" Y "b"
//   { "alguno": ["a", "b"] }               se cumple "a" O "b"

import { estanCompletosLosObjetivos, numeroDe, tieneValor } from './estado.ts';
import type { EstadoDeNivel } from './estado.ts';

/** Cómo se compara el número de una variable con otro número. Se escribe igual que en el nivel. */
export type OperadorDeComparacion = '>=' | '<=' | '>' | '<' | '=';

/** Compara el número de una variable con un número fijo. Ejemplo: `dinero >= 10`. */
export interface CondicionDeComparacion {
  readonly tipo: 'comparacion';
  readonly nombre: string;
  readonly operador: OperadorDeComparacion;
  readonly numero: number;
}

/** Una condición ya leída, lista para evaluarse. */
export type Condicion =
  | { readonly tipo: 'variable'; readonly nombre: string }
  | CondicionDeComparacion
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

// Una comparación: el nombre de una variable, un operador y un número (con signo y decimales opcionales).
// En "dinero >= 10" captura "dinero", ">=" y "10"; en "estrellas<3", "estrellas", "<" y "3".
// Los operadores de dos signos van primero para que ">=" no se lea como ">" seguido de "=10".
const EXPRESION_DE_COMPARACION = /^(.+?)\s*(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/;

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
  let sinTengo = textoLimpio;
  if (textoLimpio.startsWith(PREFIJO_TENGO)) {
    sinTengo = textoLimpio.slice(PREFIJO_TENGO.length);
  }

  const partes = EXPRESION_DE_COMPARACION.exec(sinTengo);
  if (partes === null) {
    return { tipo: 'variable', nombre: sinTengo };
  }
  return {
    tipo: 'comparacion',
    nombre: partes[1]!, // los grupos 1, 2 y 3 siempre existen cuando la expresión coincide
    operador: partes[2] as OperadorDeComparacion, // la expresión solo acepta esos cinco operadores
    numero: Number(partes[3]),
  };
}

/** Dice si la condición se cumple en ese estado. */
export function cumpleCondicion(condicion: Condicion, estado: EstadoDeNivel): boolean {
  switch (condicion.tipo) {
    case 'variable':
      return tieneValor(estado, condicion.nombre);
    case 'comparacion':
      return cumpleComparacion(condicion, estado);
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

/** Una variable sin valor, o con un valor que no es un número, cuenta como 0. */
function cumpleComparacion(condicion: CondicionDeComparacion, estado: EstadoDeNivel): boolean {
  const numeroDeLaVariable = numeroDe(estado, condicion.nombre);
  switch (condicion.operador) {
    case '>=':
      return numeroDeLaVariable >= condicion.numero;
    case '<=':
      return numeroDeLaVariable <= condicion.numero;
    case '>':
      return numeroDeLaVariable > condicion.numero;
    case '<':
      return numeroDeLaVariable < condicion.numero;
    case '=':
      return numeroDeLaVariable === condicion.numero;
  }
}

/** Los nombres de las variables que menciona una condición. Sirve para revisar que estén declaradas. */
export function variablesQueUsa(condicion: Condicion): string[] {
  switch (condicion.tipo) {
    case 'variable':
    case 'comparacion':
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
