// Ejecuta los pasos que se ven y se oyen: hablar, caminar, mover la cámara, animar, fundir a negro…
// El orden entre pasos lo decide ejecutar-pasos.ts; aquí cada paso solo ocurre.
//
// Hay tres clases de pasos, según lo que les pasa cuando la escena se salta (modo rápido,
// ver ejecucion-de-pasos.ts):
//   - los que solo se ven o se oyen (una línea, un efecto, una espera, un sonido, un video) se omiten;
//   - los que tardan y dejan algo cambiado (caminar, mover la cámara, fundir, animar) dejan su resultado final;
//   - los que ocurren de una vez (voltear, aparecer, cambiar la música, pedir salir) ocurren igual.

import type {
  PasoDeAnimacion,
  PasoDeAparicion,
  PasoDeCamara,
  PasoDeCaminata,
  PasoDeDesaparicion,
  PasoDeEfecto,
  PasoDeEspera,
  PasoDeFundido,
  PasoDeLinea,
  PasoDeMirada,
  PasoDeMusica,
  PasoDeSalida,
  PasoDeSonido,
  PasoDeVideo,
} from '../dominio/paso.ts';
import { completarTexto } from '../dominio/texto-con-variables.ts';
import { estaEnModoRapido } from './ejecucion-de-pasos.ts';
import type { EjecucionDePasos } from './ejecucion-de-pasos.ts';
import { esperarOCancelar } from './esperar-o-cancelar.ts';

type PasoQueSoloSeVe = PasoDeLinea | PasoDeEfecto | PasoDeEspera | PasoDeSonido | PasoDeVideo;
type PasoQueTarda = PasoDeCaminata | PasoDeCamara | PasoDeFundido | PasoDeAnimacion;
type PasoDeUnaVez = PasoDeMirada | PasoDeAparicion | PasoDeDesaparicion | PasoDeMusica | PasoDeSalida;

/** Los pasos que este archivo sabe ejecutar: los que no llevan otros pasos dentro ni cambian el estado. */
export type PasoDeEscena = PasoQueSoloSeVe | PasoQueTarda | PasoDeUnaVez;

export async function ejecutarPasoDeEscena(paso: PasoDeEscena, ejecucion: EjecucionDePasos): Promise<void> {
  switch (paso.tipo) {
    case 'linea':
    case 'efecto':
    case 'espera':
    case 'sonido':
    case 'video':
      await ejecutarPasoQueSoloSeVe(paso, ejecucion);
      break;

    case 'camina':
    case 'camara':
    case 'fundido':
    case 'anima':
      await ejecutarPasoQueTarda(paso, ejecucion);
      break;

    case 'mira':
    case 'aparece':
    case 'desaparece':
    case 'musica':
    case 'sale':
      await ejecutarPasoDeUnaVez(paso, ejecucion);
      break;
  }
}

/** Lo que solo se ve o se oye no deja nada cambiado: al saltar la escena, se omite. */
async function ejecutarPasoQueSoloSeVe(paso: PasoQueSoloSeVe, ejecucion: EjecucionDePasos): Promise<void> {
  if (estaEnModoRapido(ejecucion)) return;
  const { acciones, estado, senal } = ejecucion;

  switch (paso.tipo) {
    case 'linea': {
      const textoCompleto = completarTexto(paso.texto, estado.actual);
      await esperarOCancelar(acciones.decirLinea(paso, textoCompleto, senal), senal);
      break;
    }
    case 'efecto':
      await esperarOCancelar(acciones.reproducirEfecto(paso.nombre, senal), senal);
      break;
    case 'espera':
      await esperarOCancelar(acciones.esperar(paso.esperaEnSegundos, senal), senal);
      break;
    case 'sonido':
      acciones.tocarSonido(paso.clave);
      break;
    case 'video':
      await esperarOCancelar(acciones.reproducirVideo(paso.clavePorIdioma, senal), senal);
      break;
  }
}

/** Lo que tarda y deja algo cambiado: al saltar la escena, deja su resultado final de una vez. */
async function ejecutarPasoQueTarda(paso: PasoQueTarda, ejecucion: EjecucionDePasos): Promise<void> {
  const { acciones, senal } = ejecucion;

  switch (paso.tipo) {
    case 'camina': {
      // Sin `quien`, camina el jugador; la validación garantiza que entonces el nivel tiene jugador.
      const personaje = paso.personaje ?? ejecucion.contenido.jugador!.personaje;
      await tardarODejarElResultado(ejecucion, {
        tardar: () => acciones.caminar(personaje, paso.punto, senal),
        dejarElResultado: () => acciones.colocar(personaje, paso.punto),
      });
      break;
    }
    case 'camara':
      await tardarODejarElResultado(ejecucion, {
        tardar: () => acciones.moverCamara(paso, senal),
        dejarElResultado: () => acciones.cortarCamara(paso.destino),
      });
      break;
    case 'fundido':
      await tardarODejarElResultado(ejecucion, {
        tardar: () => acciones.fundir(paso, senal),
        dejarElResultado: () => acciones.dejarFundido(paso.sentido),
      });
      break;
    case 'anima':
      // Una animación que pasa una sola vez solo se ve: al saltar, se omite.
      // Una que se repite deja al personaje con otro dibujo: ocurre igual, y termina en cuanto el dibujo se ve.
      if (estaEnModoRapido(ejecucion) && !paso.repite) return;
      await acciones.animar(paso, senal);
      break;
  }
}

/** Las dos formas de ejecutar un paso que tarda. */
interface FormasDeUnPasoQueTarda {
  /** A ritmo normal: la acción completa, que debe terminar en cuanto la señal de la ejecución se dispara. */
  readonly tardar: () => Promise<void>;
  /** Cómo queda todo cuando la acción ya terminó, sin esperar nada. */
  readonly dejarElResultado: () => void;
}

/**
 * A ritmo normal ejecuta la acción completa. Si la escena se salta, antes de empezar o a la mitad,
 * deja el resultado final: así el nivel queda igual que si la escena se hubiera visto entera.
 */
async function tardarODejarElResultado(ejecucion: EjecucionDePasos, formas: FormasDeUnPasoQueTarda): Promise<void> {
  if (!estaEnModoRapido(ejecucion)) {
    await esperarOCancelar(formas.tardar(), ejecucion.senal);
  }
  if (estaEnModoRapido(ejecucion)) {
    formas.dejarElResultado();
  }
}

/** Lo que ocurre de una vez ocurre igual a ritmo normal y al saltar la escena. */
async function ejecutarPasoDeUnaVez(paso: PasoDeUnaVez, ejecucion: EjecucionDePasos): Promise<void> {
  const acciones = ejecucion.acciones;

  switch (paso.tipo) {
    case 'mira':
      acciones.mirar(paso);
      break;
    case 'aparece':
      await acciones.aparecer(paso);
      break;
    case 'desaparece':
      acciones.desaparecer(paso.personaje);
      break;
    case 'musica':
      acciones.ponerMusica(paso.clave);
      break;
    case 'sale':
      acciones.pedirSalida(paso.destino);
      break;
  }
}
