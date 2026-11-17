// Los textos de un diálogo pueden llevar variables entre llaves, que se reemplazan al mostrarse:
//   {faltan}   los objetivos pendientes, en español: «las tortillas y los aguacates»
//   {dinero}   el dinero que tiene el jugador
//
// Ejemplo: "¡Espérate! Te faltan {faltan}." → "¡Espérate! Te faltan las tortillas y los aguacates."

import { NOMBRE_DEL_DINERO, objetivosQueFaltan, valorDe } from './estado.ts';
import type { EstadoDeNivel } from './estado.ts';

/** Las variables que se pueden escribir entre llaves dentro de un texto. */
export const VARIABLES_DE_TEXTO: readonly string[] = ['faltan', 'dinero'];

// Encuentra cada variable entre llaves y captura su nombre.
// Ejemplo: en "Te faltan {faltan}." encuentra "{faltan}" y captura "faltan".
const EXPRESION_DE_VARIABLE = /\{([^{}]*)\}/g;

/** Reemplaza las variables entre llaves por su valor en ese estado. */
export function completarTexto(texto: string, estado: EstadoDeNivel): string {
  const dinero = valorDe(estado, NOMBRE_DEL_DINERO) ?? 0;
  const conLoQueFalta = texto.replaceAll('{faltan}', describirObjetivosQueFaltan(estado));
  return conLoQueFalta.replaceAll('{dinero}', String(dinero));
}

/**
 * Los nombres entre llaves que un texto usa y que no existen.
 * Ejemplo: `'Te faltan {falta}.'` → `['falta']`. Sirve para avisar de un error de dedo al validar.
 */
export function variablesDesconocidasEn(texto: string): string[] {
  const desconocidas: string[] = [];
  for (const coincidencia of texto.matchAll(EXPRESION_DE_VARIABLE)) {
    const nombre = coincidencia[1]!; // el grupo 1 siempre existe cuando la expresión coincide
    if (!VARIABLES_DE_TEXTO.includes(nombre)) {
      desconocidas.push(nombre);
    }
  }
  return desconocidas;
}

/** Los objetivos pendientes como se dicen en español: «las tortillas, los aguacates y los limones». */
function describirObjetivosQueFaltan(estado: EstadoDeNivel): string {
  const nombres: string[] = [];
  for (const objetivo of objetivosQueFaltan(estado)) {
    nombres.push(nombreConArticulo(objetivo, estado));
  }

  if (nombres.length === 0) return '';
  if (nombres.length === 1) return nombres[0]!; // acabamos de comprobar que hay uno

  const todosMenosElUltimo = nombres.slice(0, -1).join(', ');
  const ultimo = nombres[nombres.length - 1]!; // hay al menos dos
  return `${todosMenosElUltimo} y ${ultimo}`;
}

/** El nombre del objetivo como lo declara `estado.lista`; si no está ahí, el objetivo tal cual. */
function nombreConArticulo(objetivo: string, estado: EstadoDeNivel): string {
  const lista = estado.declaracion.lista;
  if (!Object.hasOwn(lista, objetivo)) return objetivo;
  return lista[objetivo]!; // `hasOwn` acaba de comprobar que existe
}
