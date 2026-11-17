// La partida guardada (docs/DISENO-3.0.md §10).
// Es un objeto plano: el host lo guarda donde quiera con `JSON.stringify`.
//
// Una partida viene de afuera, así que no es confiable: `leerPartida` revisa su forma
// y descarta lo que no entiende. Una partida corrupta nunca impide jugar.
//
// Estado: falta el campo `momento` de cada nivel (dónde quedó el jugador); se agrega con el escenario.

import { esObjetoPlano } from './es-objeto-plano.ts';
import type { ValorDeEstado, VariablesDeEstado } from './estado.ts';

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
  return { partida: { v: VERSION_DE_PARTIDA, nivel: guardada.nivel, niveles } };
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
