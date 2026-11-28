// Hace que un paso `efecto` se vea y se oiga. Termina cuando el efecto acabó, o antes si el diálogo se interrumpe.
//
//   - `magia` y `confeti` son partículas en el escenario, alrededor del jugador.
//   - `destello` es un flash blanco de toda la pantalla, como el de una cámara de fotos: sirve para cerrar
//     una escena con «la foto de la familia».
//
// Cada efecto suena con unas notas cortas, o con el sonido que el paso nombre en `sonido` (un obturador).

import type { Punto } from '../dominio/geometria.ts';
import type { PasoDeEfecto } from '../dominio/paso.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';
import { tocarSonidoEnEscena } from './sonar-en-escena.ts';

/** Una nota de la musiquita de un efecto. */
interface Nota {
  readonly frecuenciaEnHertz: number;
  readonly duracionEnSegundos: number;
  /** Cuántos segundos después de empezar el efecto suena. */
  readonly alSegundo: number;
}

/** Lo que dura cualquier efecto: el diálogo espera esto antes de seguir. */
const DURACION_DE_UN_EFECTO_EN_SEGUNDOS = 1;

const NOMBRE_DEL_DESTELLO = 'destello';
/** El destello se queda un instante todo blanco y luego se desvanece. */
const SEGUNDOS_DEL_DESTELLO_A_TODO_BLANCO = 0.08;
const SEGUNDOS_EN_QUE_SE_DESVANECE_EL_DESTELLO = 0.6;
const OPACIDAD_DEL_DESTELLO_COMPLETO = 1;
const OPACIDAD_SIN_DESTELLO = 0;

const NOTAS_POR_EFECTO: Readonly<Record<string, readonly Nota[]>> = {
  // Tres notas que suben.
  magia: [
    { frecuenciaEnHertz: 660, duracionEnSegundos: 0.15, alSegundo: 0 },
    { frecuenciaEnHertz: 880, duracionEnSegundos: 0.15, alSegundo: 0.11 },
    { frecuenciaEnHertz: 1320, duracionEnSegundos: 0.15, alSegundo: 0.22 },
  ],
  // Una nota más larga.
  confeti: [{ frecuenciaEnHertz: 990, duracionEnSegundos: 0.3, alSegundo: 0 }],
  // Dos chasquidos muy cortos, agudo y luego grave: el «clic-clac» de una cámara.
  destello: [
    { frecuenciaEnHertz: 2000, duracionEnSegundos: 0.03, alSegundo: 0 },
    { frecuenciaEnHertz: 1400, duracionEnSegundos: 0.05, alSegundo: 0.06 },
  ],
};

/** Lo que hace falta saber de un paso `efecto`: cuál es y, si el paso lo dice, con qué sonido. */
export type EfectoPorReproducir = Pick<PasoDeEfecto, 'nombre' | 'sonido'>;

export async function reproducirEfecto(
  efecto: EfectoPorReproducir,
  senal: AbortSignal,
  piezas: PiezasDeEscena,
): Promise<void> {
  if (senal.aborted) return;
  await Promise.all([
    mostrarEfecto(efecto.nombre, senal, piezas),
    sonarEfecto(efecto, senal, piezas),
    piezas.reloj.esperar(DURACION_DE_UN_EFECTO_EN_SEGUNDOS, senal),
  ]);
}

async function mostrarEfecto(nombre: string, senal: AbortSignal, piezas: PiezasDeEscena): Promise<void> {
  if (nombre === NOMBRE_DEL_DESTELLO) {
    await destellar(senal, piezas);
    return;
  }
  // Las partículas se animan solas en el escenario: no hay que esperarlas.
  piezas.escenario.reproducirEfecto(nombre, buscarDondeMostrarlo(piezas));
}

/** Con el sonido que el paso nombra, si lo nombra; si no, con las notas del efecto. */
async function sonarEfecto(efecto: EfectoPorReproducir, senal: AbortSignal, piezas: PiezasDeEscena): Promise<void> {
  if (efecto.sonido !== undefined) {
    tocarSonidoEnEscena(efecto.sonido, piezas);
    return;
  }
  let segundosTranscurridos = 0;
  for (const nota of buscarNotas(efecto.nombre)) {
    await piezas.reloj.esperar(nota.alSegundo - segundosTranscurridos, senal);
    if (senal.aborted) return;
    piezas.audio.tocarTono(nota.frecuenciaEnHertz, nota.duracionEnSegundos);
    segundosTranscurridos = nota.alSegundo;
  }
}

/** La pantalla se pone blanca de golpe y se aclara poco a poco. Si se interrumpe, el blanco se quita enseguida. */
async function destellar(senal: AbortSignal, piezas: PiezasDeEscena): Promise<void> {
  piezas.interfaz.ponerDestello(OPACIDAD_DEL_DESTELLO_COMPLETO);
  try {
    await piezas.reloj.esperar(SEGUNDOS_DEL_DESTELLO_A_TODO_BLANCO, senal);
    await desvanecerDestello(senal, piezas);
  } finally {
    // También si se interrumpió a la mitad: la pantalla nunca se queda blanca.
    piezas.interfaz.ponerDestello(OPACIDAD_SIN_DESTELLO);
  }
}

/** Baja el blanco cuadro a cuadro. Termina cuando ya no queda nada o cuando `senal` se dispara. */
function desvanecerDestello(senal: AbortSignal, piezas: PiezasDeEscena): Promise<void> {
  if (senal.aborted) return Promise.resolve();

  return new Promise((terminar) => {
    let segundosTranscurridos = 0;
    let dejarDeAvanzar = (): void => {};
    const finalizar = (): void => {
      dejarDeAvanzar();
      senal.removeEventListener('abort', finalizar);
      terminar();
    };
    dejarDeAvanzar = piezas.reloj.enCadaCuadro((segundos) => {
      segundosTranscurridos += segundos;
      const avance = Math.min(1, segundosTranscurridos / SEGUNDOS_EN_QUE_SE_DESVANECE_EL_DESTELLO);
      piezas.interfaz.ponerDestello(OPACIDAD_DEL_DESTELLO_COMPLETO * (1 - avance));
      if (avance >= 1) {
        finalizar();
      }
    });
    senal.addEventListener('abort', finalizar, { once: true });
  });
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
