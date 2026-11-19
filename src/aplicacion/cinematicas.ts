// Las cinemáticas del nivel (docs/DISENO-3.0.md §7): escenas que se reproducen solas, sin control del jugador.
// Este archivo lleva la fila de las que esperan su turno y la que está en curso. Qué las hace empezar
// lo vigila inicios-de-cinematicas.ts, y sus pasos los ejecuta ejecutar-pasos.ts.
//
// Reglas:
// - Una cinemática empieza al entrar al nivel, cuando el jugador entra a una zona, cuando se cumple
//   un objetivo, o cuando el host la pide con `juego.reproducir(id)`.
// - Solo empieza si se cumple su condición (`cuando`); sin `cuando`, se ve una sola vez.
//   La que pide el host se reproduce siempre.
// - Nunca interrumpe un diálogo: espera su turno, y varias en espera se reproducen en orden.
// - Mientras dura, se ven las franjas de cine y el jugador no controla nada.
// - Saltarla la pone en modo rápido: cada paso que falta deja su resultado final al instante.
// - Al terminar, se marca `vista.<id>` en el estado.

import { cumpleCondicion } from '../dominio/condicion.ts';
import { PREFIJO_DE_VISTAS } from '../dominio/contenido.ts';
import type { Cinematica, Contenido } from '../dominio/contenido.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Zona } from '../dominio/mundo.ts';
import type { CinematicaEnCodigo } from '../puertos/cinematica-en-codigo.ts';
import type { Interfaz } from '../puertos/interfaz.ts';
import type { AccionesDePaso } from './acciones-de-paso.ts';
import type { Conversacion } from './conversacion.ts';
import type { EjecucionDePasos } from './ejecucion-de-pasos.ts';
import { ejecutarPasos } from './ejecutar-pasos.ts';
import { EscenaEnCodigo } from './escena-en-codigo.ts';
import type { LugaresParaCodigo } from './escena-en-codigo.ts';
import type { EstadoEnJuego } from './estado-en-juego.ts';
import { IniciosDeCinematicas } from './inicios-de-cinematicas.ts';

export interface PiezasDeCinematicas {
  readonly contenido: Contenido;
  /** Las zonas del mapa, por nombre. */
  readonly zonas: Readonly<Record<string, Zona>>;
  readonly estado: EstadoEnJuego;
  readonly acciones: AccionesDePaso;
  /** Una cinemática ocupa el mismo turno que un diálogo: así nunca se enciman. */
  readonly conversacion: Conversacion;
  readonly interfaz: Interfaz;
  /** Las cinemáticas escritas en código que registró el host, por nombre. */
  readonly cinematicasEnCodigo: Readonly<Record<string, CinematicaEnCodigo>>;
  /** Lo que una cinemática en código puede nombrar del mapa y de los assets, para revisarlo al ejecutarla. */
  readonly lugares: LugaresParaCodigo;
  /** Se llama cuando una cinemática empieza y cuando termina, con su id. */
  readonly alEmpezar: (id: string) => void;
  readonly alTerminar: (id: string) => void;
}

/** Una cinemática que espera su turno. */
interface CinematicaEnEspera {
  readonly id: string;
  /** `true` si la pidió el host con `juego.reproducir()`: se reproduce aunque su condición no se cumpla. */
  readonly laPidioElHost: boolean;
  /** Avisa a quien la pidió de que ya terminó (o de que ya no se va a reproducir). */
  readonly alTerminar?: () => void;
}

export class Cinematicas {
  private readonly piezas: PiezasDeCinematicas;
  private readonly inicios: IniciosDeCinematicas;
  private enEspera: CinematicaEnEspera[] = [];
  /** Id de la cinemática que se está reproduciendo. `undefined` = ninguna. */
  private idEnCurso: string | undefined;
  /** `true` desde que el jugador salta la cinemática en curso hasta que esta termina. */
  private seSalto = false;
  /** Se dispara cuando el nivel termina: es la `senal` que reciben las cinemáticas en código. */
  private readonly finDelNivel = new AbortController();

  constructor(piezas: PiezasDeCinematicas) {
    this.piezas = piezas;
    this.inicios = new IniciosDeCinematicas(piezas);
    this.ponerEnEsperaLasQueCorresponda(this.inicios.buscarLasDeEntrada());
  }

  get hayUnaEnCurso(): boolean {
    return this.idEnCurso !== undefined;
  }

  /** `true` si hay una cinemática reproduciéndose o esperando su turno. */
  get hayAlgoPorReproducir(): boolean {
    return this.hayUnaEnCurso || this.enEspera.length > 0;
  }

  /** `true` si alguna de las que esperan su turno va a empezar de verdad: la pidió el host o su condición se cumple. */
  get hayOtraPorEmpezar(): boolean {
    for (const enEspera of this.enEspera) {
      const cinematica = this.piezas.contenido.cinematicas[enEspera.id]!; // solo se ponen en espera ids que existen
      if (enEspera.laPidioElHost || cumpleCondicion(cinematica.condicion, this.piezas.estado.actual)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Se llama en cada cuadro. `posicionDelJugador` es `undefined` en un nivel sin jugador.
   * Vigila las zonas y los objetivos que hacen empezar una cinemática y, si el turno está libre,
   * empieza la siguiente en espera.
   */
  avanzar(posicionDelJugador: Punto | undefined): void {
    if (posicionDelJugador !== undefined) {
      this.ponerEnEsperaLasQueCorresponda(this.inicios.buscarLasDeZonasRecienPisadas(posicionDelJugador));
    }
    this.ponerEnEsperaLasQueCorresponda(this.inicios.buscarLasDeObjetivosRecienCumplidos());
    if (this.piezas.conversacion.hayDialogoEnCurso) return;

    const siguiente = this.enEspera.shift();
    if (siguiente !== undefined) {
      // `reproducirAhora` nunca rechaza: si la cinemática falla, la conversación avisa por su cuenta.
      void this.reproducirAhora(siguiente);
    }
  }

  /**
   * Reproduce una cinemática a pedido del host. La promesa termina cuando la cinemática terminó
   * (si hay un diálogo en curso, espera a que acabe) y rechaza si el nivel no tiene esa cinemática.
   */
  reproducir(id: string): Promise<void> {
    if (!Object.hasOwn(this.piezas.contenido.cinematicas, id)) {
      const nivel = this.piezas.contenido.meta.id;
      return Promise.reject(new ErrorDeEscenario([`el nivel "${nivel}" no tiene una cinemática llamada "${id}"`]));
    }
    if (this.finDelNivel.signal.aborted) {
      return Promise.resolve();
    }
    return new Promise((terminar) => {
      this.enEspera.push({ id, laPidioElHost: true, alTerminar: terminar });
    });
  }

  /** Salta la cinemática en curso: los pasos que faltan dejan su resultado final. Sin cinemática, no hace nada. */
  saltar(): void {
    if (this.idEnCurso === undefined || this.seSalto) return;
    this.seSalto = true;
    // Corta el paso en curso; como `seSalto` ya es verdadero, la ejecución sigue en modo rápido.
    this.piezas.conversacion.interrumpir();
  }

  /**
   * El nivel termina: la cinemática en curso se corta sin marcarse como vista (al volver, empieza de nuevo)
   * y las que esperaban ya no se reproducen.
   */
  descartarTodo(): void {
    this.finDelNivel.abort();
    this.seSalto = false;
    const enEspera = this.enEspera;
    this.enEspera = [];
    for (const cinematica of enEspera) {
      if (cinematica.alTerminar !== undefined) {
        cinematica.alTerminar();
      }
    }
    if (this.idEnCurso !== undefined) {
      this.piezas.conversacion.interrumpir();
    }
  }

  /** Pone en espera cada cinemática cuya condición se cumple y que no está ya en curso o esperando. */
  private ponerEnEsperaLasQueCorresponda(ids: readonly string[]): void {
    for (const id of ids) {
      const yaEstaEnEspera = this.enEspera.some((cinematica) => cinematica.id === id);
      if (yaEstaEnEspera || this.idEnCurso === id) continue;

      const cinematica = this.piezas.contenido.cinematicas[id]!; // los ids salen del propio contenido
      if (cumpleCondicion(cinematica.condicion, this.piezas.estado.actual)) {
        this.enEspera.push({ id, laPidioElHost: false });
      }
    }
  }

  private async reproducirAhora(enEspera: CinematicaEnEspera): Promise<void> {
    const id = enEspera.id;
    const cinematica = this.piezas.contenido.cinematicas[id]!; // solo se ponen en espera ids que existen

    // La condición se revisa otra vez al empezar: mientras esperaba su turno, pudo dejar de cumplirse.
    const seCumpleSuCondicion = cumpleCondicion(cinematica.condicion, this.piezas.estado.actual);
    if (enEspera.laPidioElHost || seCumpleSuCondicion) {
      await this.piezas.conversacion.ejecutarEscena((senal) => this.reproducirEnSuTurno(id, cinematica, senal));
    }
    if (enEspera.alTerminar !== undefined) {
      enEspera.alTerminar();
    }
  }

  private async reproducirEnSuTurno(id: string, cinematica: Cinematica, senal: AbortSignal): Promise<void> {
    this.idEnCurso = id;
    this.seSalto = false;
    let alSaltar: (() => void) | undefined;
    if (cinematica.saltable) {
      alSaltar = () => this.saltar();
    }

    try {
      // Todo va dentro del `try`: si algo falla desde el primer momento, el `finally` deja todo en su lugar.
      this.piezas.interfaz.mostrarFranjasDeCine(alSaltar);
      this.piezas.alEmpezar(id);
      await this.ejecutarGuion(cinematica, senal);
      const elNivelSigue = !this.finDelNivel.signal.aborted;
      if (elNivelSigue) {
        this.piezas.estado.aplicar({ [PREFIJO_DE_VISTAS + id]: true });
      }
    } finally {
      // También si la cinemática falló: el jugador nunca se queda con las franjas puestas y sin control.
      this.piezas.interfaz.ocultarFranjasDeCine();
      this.idEnCurso = undefined;
      this.seSalto = false;
      this.piezas.alTerminar(id);
    }
  }

  private async ejecutarGuion(cinematica: Cinematica, senal: AbortSignal): Promise<void> {
    const ejecucion: EjecucionDePasos = {
      contenido: this.piezas.contenido,
      estado: this.piezas.estado,
      acciones: this.piezas.acciones,
      senal,
      seEstaSaltando: () => this.seSalto,
    };

    const guion = cinematica.guion;
    switch (guion.tipo) {
      case 'pasos':
        await ejecutarPasos(guion.pasos, ejecucion);
        break;
      case 'codigo': {
        if (!Object.hasOwn(this.piezas.cinematicasEnCodigo, guion.nombre)) {
          throw new Error(
            `[escenario-engine] la cinemática en código "${guion.nombre}" no está registrada en el host`,
          );
        }
        const funcion = this.piezas.cinematicasEnCodigo[guion.nombre]!; // `hasOwn` acaba de comprobar que existe
        const escena = new EscenaEnCodigo({
          nombre: guion.nombre,
          ejecucion,
          lugares: this.piezas.lugares,
          finDelNivel: this.finDelNivel.signal,
        });
        await funcion(escena);
        break;
      }
    }
  }
}
