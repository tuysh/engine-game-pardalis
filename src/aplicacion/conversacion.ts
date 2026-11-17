// Lleva el diálogo que está en curso: empieza uno al hablar con alguien, impide que empiece otro
// mientras tanto y permite interrumpirlo.
//
// Reglas:
// - Solo hay un diálogo a la vez. Si ya hay uno, el nuevo se ignora (no hay fila de espera).
// - Al hablar con alguien se usa la primera rama de su diálogo cuya condición se cumple.
// - Hablar con alguien marca la variable `charlas.<id>`.

import { cumpleCondicion } from '../dominio/condicion.ts';
import { PREFIJO_DE_CHARLAS } from '../dominio/contenido.ts';
import type { Contenido, Interlocutor, Rama } from '../dominio/contenido.ts';
import type { PasosOSecuencia } from '../dominio/paso.ts';
import type { AccionesDePaso } from './acciones-de-paso.ts';
import { ejecutarPasos, ejecutarPasosOSecuencia } from './ejecutar-pasos.ts';
import type { EstadoEnJuego } from './estado-en-juego.ts';

/** Con quién se puede hablar: un NPC o un objeto interactivo del decorado. */
export type TipoDeInterlocutor = 'npcs' | 'interactivos';

/** Lo que una conversación necesita para funcionar. */
export interface PiezasDeConversacion {
  readonly contenido: Contenido;
  readonly estado: EstadoEnJuego;
  readonly acciones: AccionesDePaso;
  /** Se llama si un diálogo falla con un error inesperado. El diálogo se da por terminado. */
  readonly alFallar: (error: unknown) => void;
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

    await this.ejecutarSiNoHayOtroDialogo(async (senal) => {
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
    await this.ejecutarSiNoHayOtroDialogo(async (senal) => {
      await ejecutarPasosOSecuencia(pasos, {
        contenido: this.piezas.contenido,
        estado: this.piezas.estado,
        acciones: this.piezas.acciones,
        senal,
      });
    });
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

  private async ejecutarSiNoHayOtroDialogo(dialogo: (senal: AbortSignal) => Promise<void>): Promise<void> {
    if (this.hayDialogoEnCurso) return;

    const cancelador = new AbortController();
    this.cancelador = cancelador;
    try {
      await dialogo(cancelador.signal);
    } catch (error) {
      this.piezas.alFallar(error);
    } finally {
      // Pase lo que pase, el diálogo se libera: si no, nadie podría volver a hablar.
      this.cancelador = undefined;
    }
  }
}
