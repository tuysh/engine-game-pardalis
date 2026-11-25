// La partida guardada (docs/DISENO-3.0.md §10).
// Es un objeto plano: el host lo guarda donde quiera con `JSON.stringify`.
//
// Una partida viene de afuera, así que no es confiable: `leerPartida` revisa su forma
// y descarta lo que no entiende. Una partida corrupta nunca impide jugar.
//
// Estado: falta el campo `momento` de cada nivel (dónde quedó el jugador): al volver a un nivel,
// el jugador empieza en su inicio.

import { esObjetoPlano } from './es-objeto-plano.ts';
import type { DeclaracionDeEstado, ValorDeEstado, VariablesDeEstado } from './estado.ts';

/** Versión del formato de partida. Una partida con otra versión se ignora con advertencia. */
export const VERSION_DE_PARTIDA = 1;

/** Lo que se guarda de un nivel ya visitado. */
export interface PartidaDeNivel {
  readonly estado: VariablesDeEstado;
}

/** Una partida completa: el nivel actual y el estado de cada nivel visitado. */
export interface Partida {
  /** Versión del formato. Siempre `VERSION_DE_PARTIDA`. */
  readonly v: typeof VERSION_DE_PARTIDA;
  /** Id del nivel en el que estaba el jugador. */
  readonly nivel: string;
  /** Estado de cada nivel visitado, por id de nivel. */
  readonly niveles: Readonly<Record<string, PartidaDeNivel>>;
  /**
   * Las variables de la aventura: las que los niveles declaran en `estado.compartidas` y viajan de uno a otro.
   * `undefined` = ningún nivel ha compartido nada.
   */
  readonly compartidas?: VariablesDeEstado;
}

/** Resultado de leer una partida que viene de afuera. */
export interface LecturaDePartida {
  /** La partida ya revisada. `undefined` = no había partida o no se pudo usar. */
  readonly partida?: Partida;
  /** Por qué se ignoró la partida. `undefined` = no hay nada que avisar. */
  readonly advertencia?: string;
}

/**
 * Revisa una partida tal como la entregó el host. Nunca lanza un error:
 * si la partida no sirve, la ignora y explica por qué en `advertencia`.
 */
export function leerPartida(guardada: unknown): LecturaDePartida {
  if (guardada === null || guardada === undefined) {
    return {};
  }
  if (!esObjetoPlano(guardada)) {
    return { advertencia: 'la partida guardada no es un objeto; se ignora' };
  }
  if (guardada.v !== VERSION_DE_PARTIDA) {
    return { advertencia: `la partida guardada es de otra versión (v: ${String(guardada.v)}); se ignora` };
  }
  if (typeof guardada.nivel !== 'string' || !esObjetoPlano(guardada.niveles)) {
    return { advertencia: 'la partida guardada está incompleta (falta "nivel" o "niveles"); se ignora' };
  }

  const niveles: Record<string, PartidaDeNivel> = {};
  for (const id of Object.keys(guardada.niveles)) {
    if (id === '__proto__') continue;
    const nivelGuardado = guardada.niveles[id];
    // Un nivel con forma extraña se descarta solo: los demás niveles de la partida siguen sirviendo.
    if (!esObjetoPlano(nivelGuardado)) continue;
    niveles[id] = { estado: limpiarVariables(nivelGuardado.estado) };
  }
  const compartidas = limpiarVariables(guardada.compartidas);
  return { partida: armarPartida(guardada.nivel, niveles, compartidas) };
}

/**
 * La partida que resulta de jugar un nivel: conserva lo guardado de los demás niveles
 * y pone, para este, sus variables de ahora. `anterior` es la partida con la que se empezó, si había.
 * Las variables que el nivel comparte se anotan aparte, con `conCompartidas`.
 */
export function actualizarPartida(
  anterior: Partida | undefined,
  idDelNivel: string,
  variables: VariablesDeEstado,
): Partida {
  const niveles: Record<string, PartidaDeNivel> = {};
  let compartidas: VariablesDeEstado = {};
  if (anterior !== undefined) {
    for (const id of Object.keys(anterior.niveles)) {
      niveles[id] = anterior.niveles[id]!; // `id` viene de `Object.keys`, así que existe
    }
    compartidas = anterior.compartidas ?? {};
  }
  niveles[idDelNivel] = { estado: variables };
  return armarPartida(idDelNivel, niveles, compartidas);
}

/** La misma partida, con esas variables de la aventura puestas encima de las que ya tenía. */
export function conCompartidas(partida: Partida, nuevas: VariablesDeEstado): Partida {
  const compartidas: Record<string, ValorDeEstado> = {};
  const anteriores = partida.compartidas ?? {};
  for (const nombre of Object.keys(anteriores)) {
    compartidas[nombre] = anteriores[nombre]!; // `nombre` viene de `Object.keys`, así que existe
  }
  for (const nombre of Object.keys(nuevas)) {
    compartidas[nombre] = nuevas[nombre]!; // `nombre` viene de `Object.keys`, así que existe
  }
  return armarPartida(partida.nivel, partida.niveles, compartidas);
}

/**
 * La misma partida, pero diciendo que el jugador está en otro nivel. Se usa cuando un nivel sale hacia otro:
 * desde ese momento, si el juego se cierra, debe continuar en el nivel de destino.
 */
export function conElJugadorEn(partida: Partida, idDelNivel: string): Partida {
  return armarPartida(idDelNivel, partida.niveles, partida.compartidas ?? {});
}

/** Las variables guardadas de un nivel, o `undefined` si la partida no tiene ese nivel. */
export function variablesGuardadasDe(partida: Partida | undefined, idDelNivel: string): VariablesDeEstado | undefined {
  if (partida === undefined || !Object.hasOwn(partida.niveles, idDelNivel)) return undefined;
  return partida.niveles[idDelNivel]!.estado; // `hasOwn` acaba de comprobar que existe
}

/**
 * Las variables con las que un nivel empieza a jugarse: las que guardó la última vez y, encima, las de la
 * aventura que ese nivel declara en `estado.compartidas`. `undefined` = no hay nada guardado: empieza de cero.
 */
export function variablesParaJugar(
  partida: Partida | undefined,
  idDelNivel: string,
  declaracion: DeclaracionDeEstado,
): VariablesDeEstado | undefined {
  if (partida === undefined) return undefined;

  const variables: Record<string, ValorDeEstado> = {};
  const propias = variablesGuardadasDe(partida, idDelNivel) ?? {};
  for (const nombre of Object.keys(propias)) {
    variables[nombre] = propias[nombre]!; // `nombre` viene de `Object.keys`, así que existe
  }

  const compartidas = partida.compartidas ?? {};
  for (const nombre of declaracion.compartidas ?? []) {
    // Solo entran las que este nivel declara: lo que otro nivel compartió y este no conoce, no le llega.
    if (Object.hasOwn(compartidas, nombre)) {
      variables[nombre] = compartidas[nombre]!; // `hasOwn` acaba de comprobar que existe
    }
  }
  return variables;
}

/** Arma la partida. El campo `compartidas` solo aparece si hay algo que compartir. */
function armarPartida(
  nivel: string,
  niveles: Readonly<Record<string, PartidaDeNivel>>,
  compartidas: VariablesDeEstado,
): Partida {
  if (Object.keys(compartidas).length === 0) {
    return { v: VERSION_DE_PARTIDA, nivel, niveles };
  }
  return { v: VERSION_DE_PARTIDA, nivel, niveles, compartidas };
}

/** Conserva solo las variables con un valor que el estado puede guardar. */
function limpiarVariables(guardadas: unknown): VariablesDeEstado {
  const variables: Record<string, ValorDeEstado> = {};
  if (!esObjetoPlano(guardadas)) return variables;

  for (const nombre of Object.keys(guardadas)) {
    if (nombre === '__proto__') continue;
    const valor = guardadas[nombre];
    const esNumeroUsable = typeof valor === 'number' && Number.isFinite(valor);
    if (typeof valor === 'boolean' || typeof valor === 'string' || esNumeroUsable) {
      variables[nombre] = valor;
    }
  }
  return variables;
}
