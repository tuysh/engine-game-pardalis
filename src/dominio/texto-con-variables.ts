// Los textos de un diálogo pueden llevar variables entre llaves, que se reemplazan al mostrarse:
//   {faltan}           los objetivos pendientes, en español: «las tortillas y los aguacates»
//   {falta_o_faltan}   el verbo que concuerda con {faltan}: «falta» si lo único que falta es singular («el maíz»)
//   {cuantos_faltan}   cuántos objetivos faltan, con número: «2»
//   {dinero}           el dinero que tiene el jugador
//   {estrellas}        el número de cualquier variable de `estado.variables` o `estado.compartidas`
//
// Ejemplo: "Te {falta_o_faltan} {faltan}." → "Te falta el maíz." o "Te faltan las tortillas y el maíz."

import { NOMBRE_DEL_DINERO, numeroDe, objetivosQueFaltan } from './estado.ts';
import type { DeclaracionDeEstado, EstadoDeNivel } from './estado.ts';
import { numeroGramaticalDe } from './numero-gramatical.ts';

/** Las variables que el motor calcula y que se pueden escribir entre llaves en cualquier texto. */
export const VARIABLES_DE_TEXTO: readonly string[] = ['faltan', 'falta_o_faltan', 'cuantos_faltan', 'dinero'];

/** La variable de texto que da el verbo «falta» o «faltan». */
export const VARIABLE_DEL_VERBO_FALTAR = 'falta_o_faltan';

// Encuentra cada variable entre llaves y captura su nombre.
// Ejemplo: en "Te faltan {faltan}." encuentra "{faltan}" y captura "faltan".
const EXPRESION_DE_VARIABLE = /\{([^{}]*)\}/g;

/**
 * Reemplaza las variables entre llaves por su valor en ese estado.
 * Un nombre que no es una variable de texto ni del nivel queda como está, con sus llaves (la validación lo avisa).
 */
export function completarTexto(texto: string, estado: EstadoDeNivel): string {
  return texto.replace(EXPRESION_DE_VARIABLE, (conLlaves: string, nombre: string) => {
    const valor = valorParaElTexto(nombre, estado);
    if (valor === undefined) return conLlaves;
    return valor;
  });
}

/**
 * Las variables del nivel que un texto puede mostrar con su número: las de `estado.variables` y `estado.compartidas`.
 * Los objetivos no, porque guardan «ya lo tengo» y no un número.
 */
export function variablesQueSePuedenMostrar(declaracion: DeclaracionDeEstado): string[] {
  return [...declaracion.variables, ...(declaracion.compartidas ?? [])];
}

/**
 * Los nombres entre llaves que un texto usa y que no existen en ese nivel.
 * Ejemplo: `'Te faltan {falta}.'` → `['falta']`. Sirve para avisar de un error de dedo al validar.
 */
export function variablesDesconocidasEn(texto: string, declaracion: DeclaracionDeEstado): string[] {
  const delNivel = variablesQueSePuedenMostrar(declaracion);
  const desconocidas: string[] = [];
  for (const nombre of nombresEntreLlaves(texto)) {
    if (VARIABLES_DE_TEXTO.includes(nombre)) continue;
    if (delNivel.includes(nombre)) continue;
    desconocidas.push(nombre);
  }
  return desconocidas;
}

/** Los nombres que un texto escribe entre llaves, en orden. Ejemplo: `'{a} y {b}'` → `['a', 'b']`. */
export function nombresEntreLlaves(texto: string): string[] {
  const nombres: string[] = [];
  for (const coincidencia of texto.matchAll(EXPRESION_DE_VARIABLE)) {
    nombres.push(coincidencia[1]!); // el grupo 1 siempre existe cuando la expresión coincide
  }
  return nombres;
}

/** Lo que va en lugar de `{nombre}`, o `undefined` si ese nombre no es una variable que se pueda mostrar. */
function valorParaElTexto(nombre: string, estado: EstadoDeNivel): string | undefined {
  switch (nombre) {
    case 'faltan':
      return describirObjetivosQueFaltan(estado);
    case VARIABLE_DEL_VERBO_FALTAR:
      return elegirFaltaOFaltan(estado);
    case 'cuantos_faltan':
      return String(objetivosQueFaltan(estado).length);
    case NOMBRE_DEL_DINERO:
      return String(numeroDe(estado, NOMBRE_DEL_DINERO));
  }
  if (variablesQueSePuedenMostrar(estado.declaracion).includes(nombre)) {
    // Igual que en las comparaciones: sin valor, o con un valor que no es un número, cuenta como 0.
    return String(numeroDe(estado, nombre));
  }
  return undefined;
}

/**
 * «falta» solo cuando queda un objetivo y su nombre es singular («el maíz»).
 * Con dos o más, con uno plural («las tortillas») o con uno que no se sabe, «faltan».
 */
function elegirFaltaOFaltan(estado: EstadoDeNivel): string {
  const pendientes = objetivosQueFaltan(estado);
  if (pendientes.length !== 1) return 'faltan';

  const unico = nombreConArticulo(pendientes[0]!, estado.declaracion); // acabamos de comprobar que hay uno
  if (numeroGramaticalDe(unico) === 'singular') return 'falta';
  return 'faltan';
}

/** Los objetivos pendientes como se dicen en español: «las tortillas, los aguacates y los limones». */
function describirObjetivosQueFaltan(estado: EstadoDeNivel): string {
  const nombres: string[] = [];
  for (const objetivo of objetivosQueFaltan(estado)) {
    nombres.push(nombreConArticulo(objetivo, estado.declaracion));
  }

  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0]!; // acabamos de comprobar que hay uno

  const todosMenosElUltimo = nombres.slice(0, -1).join(', ');
  const ultimo = nombres[nombres.length - 1]!; // hay al menos dos
  return `${todosMenosElUltimo} y ${ultimo}`;
}

/** El nombre del objetivo como lo declara `estado.lista`; si no está ahí, el objetivo tal cual. */
export function nombreConArticulo(objetivo: string, declaracion: DeclaracionDeEstado): string {
  const lista = declaracion.lista;
  if (!Object.hasOwn(lista, objetivo)) return objetivo;
  return lista[objetivo]!; // `hasOwn` acaba de comprobar que existe
}
