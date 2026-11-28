// Lleva el diálogo que está en curso: empieza uno al hablar con alguien, impide que empiece otro
// mientras tanto y permite interrumpirlo.
//
// Reglas:
// - Solo hay un diálogo a la vez. Si ya hay uno, el nuevo se ignora (no hay fila de espera).
// - Una cinemática ocupa el mismo turno que un diálogo (`ejecutarEscena`): mientras dura, nadie habla.
// - Al hablar con alguien se usa la primera rama de su diálogo cuya condición se cumple.
// - Hablar con alguien marca la variable `charlas.<id>`.
// - Cada diálogo avisa cuándo empieza y cuándo termina (`alEmpezarDialogo`, `alTerminarDialogo`), con quién
//   lo empezó. Una cinemática no: ella avisa por su cuenta.

import { cumpleCondicion } from '../dominio/condicion.ts';
import { PREFIJO_DE_CHARLAS } from '../dominio/contenido.ts';
import type { Contenido, Interlocutor, Rama } from '../dominio/contenido.ts';
import type { PasosOSecuencia } from '../dominio/paso.ts';
import type { AccionesDePaso } from './acciones-de-paso.ts';
import { ejecutarPasos, ejecutarPasosOSecuencia } from './ejecutar-pasos.ts';
import type { EstadoEnJuego } from './estado-en-juego.ts';

/** Con quién se puede hablar: un NPC o un objeto interactivo del decorado. */
export type TipoDeInterlocutor = 'npcs' | 'interactivos';

/**
 * Qué hizo que alguien hablara: tocar un NPC, tocar un interactivo, intentar salir por una salida cerrada
 * (`salida.siBloqueada`) o entrar a una zona con comentarios (comentarios-de-zona.ts).
 */
export type OrigenDeDialogo = 'npc' | 'interactivo' | 'salida' | 'comentario';

/** Un diálogo que empieza o termina, tal como se avisa. */
export interface DialogoDelNivel {
  readonly origen: OrigenDeDialogo;
  /** El id del NPC o del interactivo, o el nombre de la zona del comentario. `undefined` en una salida. */
  readonly id: string | undefined;
}

const ORIGEN_POR_TIPO: Readonly<Record<TipoDeInterlocutor, OrigenDeDialogo>> = {
  npcs: 'npc',
  interactivos: 'interactivo',
};

/** Lo que una conversación necesita para funcionar. */
export interface PiezasDeConversacion {
  readonly contenido: Contenido;
  readonly estado: EstadoEnJuego;
  readonly acciones: AccionesDePaso;
  /** Se llama si un diálogo falla con un error inesperado. El diálogo se da por terminado. */
  readonly alFallar: (error: unknown) => void;
  /** Se llama justo antes de que empiece cada diálogo; sirve, por ejemplo, para callar un comentario. */
  readonly alEmpezar?: () => void;
  /** Se llama cuando un diálogo ya terminó (bien, interrumpido o con error) y el turno quedó libre. */
  readonly alTerminar?: () => void;
  /** Se llama al empezar un diálogo (no una cinemática), después de `alEmpezar`. */
  readonly alEmpezarDialogo?: (dialogo: DialogoDelNivel) => void;
  /** Se llama al terminar ese diálogo, pase lo que pase, antes de `alTerminar`. */
  readonly alTerminarDialogo?: (dialogo: DialogoDelNivel) => void;
}

export class Conversacion {
  private readonly piezas: PiezasDeConversacion;
  /** Existe solo mientras hay un diálogo en curso. */
  private cancelador: AbortController | undefined;

  constructor(piezas: PiezasDeConversacion) {
    this.piezas = piezas;
  }

  get hayDialogoEnCurso(): boolean {
    return this.cancelador !== undefined;
  }

  /** Habla con un NPC o un interactivo. Termina cuando el diálogo terminó. */
  async hablarCon(tipo: TipoDeInterlocutor, id: string): Promise<void> {
    const interlocutores = this.piezas.contenido[tipo];
    if (!Object.hasOwn(interlocutores, id)) return;
    const interlocutor = interlocutores[id]!; // `hasOwn` acaba de comprobar que existe

    const dialogo: DialogoDelNivel = { origen: ORIGEN_POR_TIPO[tipo], id };
    await this.ejecutarSiNoHayOtroDialogo(dialogo, async (senal) => {
      // La rama se elige antes de marcar la charla: así "charlas.<id>" es falsa en la primera visita.
      const rama = this.buscarRamaQueSeCumple(interlocutor);
      this.piezas.estado.aplicar({ [PREFIJO_DE_CHARLAS + id]: true });
      if (rama === undefined) return;

      await ejecutarPasos(rama.pasos, {
        contenido: this.piezas.contenido,
        estado: this.piezas.estado,
        acciones: this.piezas.acciones,
        senal,
        alVolver: interlocutor.alVolver,
      });
    });
  }

  /** Ejecuta pasos que no son el diálogo de nadie, como `salida.siBloqueada`. */
  async ejecutar(pasos: PasosOSecuencia): Promise<void> {
    const dialogo: DialogoDelNivel = { origen: 'salida', id: undefined };
    await this.ejecutarSiNoHayOtroDialogo(dialogo, async (senal) => {
      await ejecutarPasosOSecuencia(pasos, {
        contenido: this.piezas.contenido,
        estado: this.piezas.estado,
        acciones: this.piezas.acciones,
        senal,
      });
    });
  }

  /**
   * Ejecuta una escena que no es un diálogo (una cinemática) con la misma regla de «una cosa a la vez»:
   * si hay un diálogo en curso, la escena no se ejecuta. Mientras dura, cuenta como diálogo en curso,
   * y `interrumpir()` dispara la señal que la escena recibe.
   */
  async ejecutarEscena(escena: (senal: AbortSignal) => Promise<void>): Promise<void> {
    // Una cinemática no es un diálogo: no se avisa como tal (`undefined`).
    await this.ejecutarSiNoHayOtroDialogo(undefined, escena);
  }

  /** Termina el diálogo en curso. Si no hay ninguno, no hace nada. */
  interrumpir(): void {
    if (this.cancelador !== undefined) {
      this.cancelador.abort();
    }
  }

  private buscarRamaQueSeCumple(interlocutor: Interlocutor): Rama | undefined {
    for (const rama of interlocutor.dialogo) {
      if (rama.condicion === undefined) return rama;
      if (cumpleCondicion(rama.condicion, this.piezas.estado.actual)) return rama;
    }
    return undefined;
  }

  /** `dialogo` dice de quién es, para avisarlo; es `undefined` en una cinemática, que no se avisa como diálogo. */
  private async ejecutarSiNoHayOtroDialogo(
    dialogo: DialogoDelNivel | undefined,
    pasos: (senal: AbortSignal) => Promise<void>,
  ): Promise<void> {
    if (this.hayDialogoEnCurso) return;

    const cancelador = new AbortController();
    this.cancelador = cancelador;
    try {
      if (this.piezas.alEmpezar !== undefined) {
        this.piezas.alEmpezar();
      }
      if (dialogo !== undefined && this.piezas.alEmpezarDialogo !== undefined) {
        this.piezas.alEmpezarDialogo(dialogo);
      }
      await pasos(cancelador.signal);
    } catch (error) {
      this.piezas.alFallar(error);
    } finally {
      // Pase lo que pase, el diálogo se libera: si no, nadie podría volver a hablar.
      this.cancelador = undefined;
      // Si el diálogo falló con pasos todavía en marcha (los de un `juntos`), esto los detiene.
      cancelador.abort();
      // El fin del diálogo se avisa antes que `alTerminar`, que puede terminar el nivel con un `sale`:
      // así el host nunca recibe la salida con su interfaz todavía escondida por el diálogo.
      if (dialogo !== undefined && this.piezas.alTerminarDialogo !== undefined) {
        this.piezas.alTerminarDialogo(dialogo);
      }
      if (this.piezas.alTerminar !== undefined) {
        this.piezas.alTerminar();
      }
    }
  }
}
