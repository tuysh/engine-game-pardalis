// Hace que un paso `efecto` se vea y se oiga: partículas en el escenario y unas notas cortas.
// Termina cuando el efecto acabó, o antes si el diálogo se interrumpe.

import type { Punto } from '../dominio/geometria.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';

/** Una nota de la musiquita de un efecto. */
interface Nota {
  readonly frecuenciaEnHertz: number;
  readonly duracionEnSegundos: number;
  /** Cuántos segundos después de empezar el efecto suena. */
  readonly alSegundo: number;
}

/** Lo que dura cualquier efecto: el diálogo espera esto antes de seguir. */
const DURACION_DE_UN_EFECTO_EN_SEGUNDOS = 1;

const NOTAS_POR_EFECTO: Readonly<Record<string, readonly Nota[]>> = {
  // Tres notas que suben.
  magia: [
    { frecuenciaEnHertz: 660, duracionEnSegundos: 0.15, alSegundo: 0 },
    { frecuenciaEnHertz: 880, duracionEnSegundos: 0.15, alSegundo: 0.11 },
    { frecuenciaEnHertz: 1320, duracionEnSegundos: 0.15, alSegundo: 0.22 },
  ],
  // Una nota más larga.
  confeti: [{ frecuenciaEnHertz: 990, duracionEnSegundos: 0.3, alSegundo: 0 }],
};

export async function reproducirEfecto(nombre: string, senal: AbortSignal, piezas: PiezasDeEscena): Promise<void> {
  if (senal.aborted) return;
  piezas.escenario.reproducirEfecto(nombre, buscarDondeMostrarlo(piezas));

  let segundosTranscurridos = 0;
  for (const nota of buscarNotas(nombre)) {
    await piezas.reloj.esperar(nota.alSegundo - segundosTranscurridos, senal);
    if (senal.aborted) return;
    piezas.audio.tocarTono(nota.frecuenciaEnHertz, nota.duracionEnSegundos);
    segundosTranscurridos = nota.alSegundo;
  }
  await piezas.reloj.esperar(DURACION_DE_UN_EFECTO_EN_SEGUNDOS - segundosTranscurridos, senal);
}

function buscarNotas(nombre: string): readonly Nota[] {
  if (!Object.hasOwn(NOTAS_POR_EFECTO, nombre)) return [];
  return NOTAS_POR_EFECTO[nombre]!; // `hasOwn` acaba de comprobar que existe
}

/** El efecto aparece sobre el jugador; en un nivel sin jugador, en el centro del lugar. */
function buscarDondeMostrarlo(piezas: PiezasDeEscena): Punto {
  const jugador = piezas.contenido.jugador;
  if (jugador !== undefined) {
    const posicion = piezas.reparto.posicionDe(jugador.personaje);
    if (posicion !== undefined) return posicion;
  }
  return piezas.centroDelLugar;
}
