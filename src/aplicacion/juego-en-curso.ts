// Lleva el juego completo: qué nivel se está jugando, el paso de un nivel a otro y la partida de todos
// (docs/DISENO-3.0.md §4, §5.3 y §10).
//
// Reglas:
// - Solo se juega un nivel a la vez. Al cargar otro, el anterior termina y su estado queda en la partida.
// - Si el nivel nuevo no puede empezar (por ejemplo, no cargó una de sus imágenes), se vuelve a jugar
//   el anterior con su estado guardado: el juego nunca se queda sin nivel.
// - Cuando un nivel termina hacia un destino que es otro nivel registrado, ese nivel se carga solo:
//   la pantalla se cierra a negro, se cambia de lugar y el nivel nuevo la abre al empezar.
//   Cualquier otro destino se le avisa al host, que decide qué hacer.
// - Conviene guardar al cumplir un objetivo, al terminar una cinemática, al salir y al cambiar de nivel.
//   La partida la lleva partida-en-curso.ts.
// - Al volver a un nivel ya visitado, se restauran sus variables.
// - Las variables que un nivel declara en `estado.compartidas` son de la aventura: viajan de un nivel a otro.

import { convertirEnErrorDeEscenario, ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { separarCompartidas } from '../dominio/estado.ts';
import type { EstadoDeNivel } from '../dominio/estado.ts';
import type { Partida } from '../dominio/partida.ts';
import { FundidoDePantalla } from './fundido-de-pantalla.ts';
import { jugarNivel } from './jugar-nivel.ts';
import { leerNivelPorJugar } from './leer-nivel-por-jugar.ts';
import type { NivelPorJugar } from './leer-nivel-por-jugar.ts';
import type { AvisosDelNivel, NivelEnJuego } from './nivel-en-juego.ts';
import { PartidaEnCurso } from './partida-en-curso.ts';
import type { PiezasDelJuegoEnCurso } from './piezas-del-juego-en-curso.ts';

/** Lo que tarda la pantalla en cerrarse a negro cuando un nivel sale hacia otro. */
const DURACION_DEL_CIERRE_ENTRE_NIVELES_EN_SEGUNDOS = 0.4;

/** El nivel que se está jugando. */
interface NivelActual {
  /** El nivel tal como se leyó: con él se puede volver a jugar si el nivel siguiente no logra empezar. */
  readonly porJugar: NivelPorJugar;
  readonly enJuego: NivelEnJuego;
}

export class JuegoEnCurso {
  private readonly piezas: PiezasDelJuegoEnCurso;
  /** El fundido de la pantalla es uno solo para todos los niveles: así cada nivel sabe cómo la dejó el anterior. */
  private readonly fundido: FundidoDePantalla;
  private readonly partida: PartidaEnCurso;
  /** `undefined` mientras se carga el primer nivel o se pasa de un nivel a otro. */
  private nivelActual: NivelActual | undefined;
  /** Id del último nivel que se jugó: es el que se informa mientras carga el siguiente. `undefined` = ninguno aún. */
  private idDelUltimoNivel: string | undefined;
  /** `true` desde que se pide otro nivel hasta que ya se puede jugar (o hasta que falla). */
  private seEstaCambiandoDeNivel = false;
  private estaTerminado = false;

  constructor(piezas: PiezasDelJuegoEnCurso) {
    this.piezas = piezas;
    this.fundido = new FundidoDePantalla(piezas.puertos.interfaz, piezas.puertos.reloj);
    this.partida = new PartidaEnCurso(piezas.partidaInicial);
  }

  /** Id del nivel que se está jugando. Antes de que empiece el primero, es un texto vacío. */
  get idDelNivel(): string {
    return this.idDelUltimoNivel ?? '';
  }

  /**
   * La partida de este momento: el estado del nivel actual y el de los niveles visitados antes.
   * Mientras se pasa a otro nivel, ya dice que el jugador está en el nivel de destino.
   */
  leerPartida(): Partida {
    if (this.nivelActual === undefined) {
      return this.partida.leerSinNivelEnJuego(this.idDelNivel);
    }
    const variables = separarCompartidas(this.nivelActual.enJuego.leerEstado());
    return this.partida.leerJugando(this.nivelActual.porJugar.id, variables);
  }

  /** El estado del nivel que se está jugando. `undefined` mientras se carga un nivel o si el juego ya terminó. */
  leerEstado(): EstadoDeNivel | undefined {
    if (this.nivelActual === undefined) return undefined;
    return this.nivelActual.enJuego.leerEstado();
  }

  /**
   * Pone a jugar un nivel ya leído y validado; el que se estuviera jugando termina.
   * La promesa termina cuando el nivel ya se puede jugar. Si el nivel no logra empezar, rechaza con el error
   * y vuelve a poner a jugar el nivel anterior.
   */
  async jugar(porJugar: NivelPorJugar): Promise<void> {
    const anterior = this.nivelActual;
    if (anterior !== undefined) {
      this.dejarElNivel(anterior);
    }

    let enJuego: NivelEnJuego | undefined;
    try {
      enJuego = await this.ponerAJugar(porJugar);
    } catch (error) {
      if (anterior !== undefined) {
        await this.volverAJugar(anterior.porJugar);
      }
      throw error;
    }
    // `undefined` = el juego se destruyó mientras el nivel cargaba: ya no se juega.
    if (enJuego === undefined) return;

    const idDelNivelAnterior = this.idDelUltimoNivel;
    this.nivelActual = { porJugar, enJuego };
    this.idDelUltimoNivel = porJugar.id;
    this.partida.olvidarLaSalida();
    // El primer nivel no avisa: quien creó el juego todavía no escucha.
    if (idDelNivelAnterior !== undefined) {
      this.piezas.avisos.alCambiarDeNivel(porJugar.id, idDelNivelAnterior);
      this.piezas.avisos.alGuardar(this.leerPartida());
    }
  }

  /**
   * Cambia de nivel: lo lee, lo valida y lo pone a jugar. `nombre` es un id de `niveles` o la dirección
   * de un `nivel.json`. Rechaza con `ErrorDeEscenario` si el nivel no se pudo leer, tiene errores
   * o no logra empezar; en ese caso se sigue jugando el nivel que estaba.
   */
  async cargar(nombre: string): Promise<void> {
    if (this.estaTerminado) {
      throw new ErrorDeEscenario([`no se cargó el nivel "${nombre}": el juego ya se destruyó`]);
    }
    if (this.seEstaCambiandoDeNivel) {
      throw new ErrorDeEscenario([`no se cargó el nivel "${nombre}": ya se está cargando otro nivel`]);
    }

    this.seEstaCambiandoDeNivel = true;
    try {
      await this.leerYJugar(nombre);
    } finally {
      this.seEstaCambiandoDeNivel = false;
    }
  }

  /** Reproduce una cinemática del nivel actual a pedido del host. Termina cuando la cinemática terminó. */
  reproducir(idDeCinematica: string): Promise<void> {
    if (this.nivelActual === undefined) {
      return Promise.reject(
        new ErrorDeEscenario([`no se reprodujo la cinemática "${idDeCinematica}": no hay un nivel en juego`]),
      );
    }
    return this.nivelActual.enJuego.reproducirCinematica(idDeCinematica);
  }

  /** Salta la cinemática o cierra el diálogo en curso. */
  interrumpir(): void {
    if (this.nivelActual !== undefined) {
      this.nivelActual.enJuego.interrumpir();
    }
  }

  /** Termina el nivel en juego y ya no carga ninguno más. Se puede llamar más de una vez. */
  terminar(): void {
    if (this.estaTerminado) return;
    if (this.nivelActual !== undefined) {
      // Su estado queda anotado: así el host puede pedir la partida después de destruir el juego.
      this.dejarElNivel(this.nivelActual);
    }
    this.estaTerminado = true;
  }

  /** Termina el nivel que se juega y anota su estado en la partida, para restaurarlo si el jugador vuelve. */
  private dejarElNivel(nivel: NivelActual): void {
    this.partida.anotarNivel(nivel.porJugar.id, separarCompartidas(nivel.enJuego.leerEstado()));
    nivel.enJuego.terminar();
    this.nivelActual = undefined;
  }

  /**
   * Monta un nivel y lo deja jugándose, con las variables que la partida tenga guardadas para él.
   * Devuelve `undefined` si el juego se destruyó mientras el nivel cargaba.
   */
  private async ponerAJugar(porJugar: NivelPorJugar): Promise<NivelEnJuego | undefined> {
    const pedido = {
      nivel: porJugar.nivel,
      ubicacion: {
        direccionDelNivel: porJugar.direccion,
        raizDeAssets: this.piezas.raizDeAssets,
        cargador: this.piezas.cargador,
      },
      idiomaBase: this.piezas.idiomaBase,
      minijuegos: this.piezas.minijuegos,
      cinematicasEnCodigo: this.piezas.cinematicasEnCodigo,
      variablesGuardadas: this.partida.variablesPara(porJugar.id, porJugar.nivel.contenido.estado),
      conMenosMovimiento: this.piezas.conMenosMovimiento,
      alCargar: this.piezas.alCargar,
      depuracion: this.piezas.depuracion,
      fundido: this.fundido,
    };
    const enJuego = await jugarNivel(pedido, this.piezas.puertos, this.crearAvisosDelNivel(porJugar.id));
    if (this.estaTerminado) {
      enJuego.terminar();
      return undefined;
    }
    return enJuego;
  }

  /**
   * El nivel siguiente no logró empezar: se pone a jugar otra vez el que se había dejado, con su estado
   * guardado (el jugador aparece en su inicio). Así el juego no se queda sin nivel.
   */
  private async volverAJugar(anterior: NivelPorJugar): Promise<void> {
    try {
      const enJuego = await this.ponerAJugar(anterior);
      if (enJuego !== undefined) {
        this.nivelActual = { porJugar: anterior, enJuego };
      }
    } catch (error) {
      // Ya no hay a dónde volver. Quien pidió el cambio de nivel recibe el primer error y decide qué hacer.
      console.error(`[escenario-engine] tampoco se pudo volver al nivel "${anterior.id}":`, error);
    }
  }

  private crearAvisosDelNivel(idDelNivel: string): AvisosDelNivel {
    const avisos = this.piezas.avisos;
    return {
      alCumplirObjetivo: (objetivo) => {
        avisos.alCumplirObjetivo(objetivo);
        avisos.alGuardar(this.leerPartida());
      },
      alVerPalabra: (palabra) => avisos.alVerPalabra(palabra),
      alSalir: (destino) => this.salirHacia(destino),
      alFallar: (error) => {
        console.error('[escenario-engine] una escena falló y se dio por terminada:', error);
        avisos.alFallar(convertirEnErrorDeEscenario(error));
      },
      alEmpezarCinematica: (id) => avisos.alEmpezarCinematica(id),
      alTerminarCinematica: (id) => {
        avisos.alTerminarCinematica(id);
        avisos.alGuardar(this.leerPartida());
      },
      alCambiarElEstado: (cambios, estado) => {
        avisos.alCambiarElEstado({ nivel: idDelNivel, cambios, variables: estado.variables });
      },
      alEmpezarMinijuego: (nombre) => avisos.alEmpezarMinijuego(nombre),
      alTerminarMinijuego: (nombre) => avisos.alTerminarMinijuego(nombre),
    };
  }

  /** El nivel terminó hacia un destino: si es otro nivel registrado se carga solo; si no, decide el host. */
  private salirHacia(destino: string): void {
    const esOtroNivel = Object.hasOwn(this.piezas.fuente.niveles, destino);
    if (!esOtroNivel) {
      this.piezas.avisos.alGuardar(this.leerPartida());
      this.piezas.avisos.alSalir(destino);
      return;
    }
    // Si el jugador vuelve a pisar la salida mientras el nivel siguiente carga, no se carga dos veces.
    if (this.seEstaCambiandoDeNivel) return;

    // Desde aquí la partida dice que el jugador está en el nivel de destino (ver partida-en-curso.ts).
    this.partida.salirHacia(destino);
    this.piezas.avisos.alGuardar(this.leerPartida());
    void this.pasarAlNivel(destino);
  }

  /** Cierra la pantalla a negro y pasa al otro nivel. Si el nivel no se puede cargar, avisa y sigue el que estaba. */
  private async pasarAlNivel(nombre: string): Promise<void> {
    this.seEstaCambiandoDeNivel = true;
    try {
      // Nadie corta este fundido, así que su señal nunca se dispara.
      // Si una cinemática ya había cerrado la pantalla, esto termina de inmediato.
      const sinCortar = new AbortController().signal;
      await this.fundido.fundir('cerrar', DURACION_DEL_CIERRE_ENTRE_NIVELES_EN_SEGUNDOS, sinCortar);
      if (this.estaTerminado) return;
      await this.leerYJugar(nombre);
    } catch (error) {
      // No se llegó: el jugador sigue en el nivel que estaba, y con la pantalla en negro no lo vería.
      // La última partida avisada todavía nombra el destino: al volver a abrir el juego, se intenta otra vez.
      this.partida.olvidarLaSalida();
      this.fundido.dejar('abrir');
      console.error(`[escenario-engine] no se pudo cargar el nivel "${nombre}":`, error);
      this.piezas.avisos.alFallar(convertirEnErrorDeEscenario(error));
    } finally {
      this.seEstaCambiandoDeNivel = false;
    }
  }

  private async leerYJugar(nombre: string): Promise<void> {
    const porJugar = await leerNivelPorJugar(nombre, this.piezas.fuente);
    if (this.estaTerminado) return;
    await this.jugar(porJugar);
  }
}
