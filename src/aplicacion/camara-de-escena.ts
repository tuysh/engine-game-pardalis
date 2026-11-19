// La cámara del nivel mientras se juega: a qué apunta y cómo pasa de un encuadre a otro.
//
// La cámara siempre apunta a algo: a un personaje (y entonces lo sigue cuando camina) o a un lugar fijo.
// Al empezar apunta al jugador o, en un nivel sin jugador, al centro del lugar.
// Un paso `camara` cambia a qué apunta:
//   - sin duración es un corte: la cámara salta al encuadre nuevo;
//   - con duración es un viaje: la cámara va con suavidad del encuadre que tenía al nuevo.
//
// Con «movimiento reducido» activo en el sistema, los viajes se vuelven cortes (docs/DISENO-3.0.md §7.5).

import type { AjustesDeCamara, Contenido } from '../dominio/contenido.ts';
import { mezclarEncuadres, perseguirEncuadre, suavizarAvance } from '../dominio/encuadre.ts';
import type { Encuadre } from '../dominio/encuadre.ts';
import { centroDeRectangulo } from '../dominio/forma.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Decorado } from '../dominio/mundo.ts';
import { CAMARA_AL_JUGADOR } from '../dominio/paso.ts';
import type { Escenario } from '../puertos/escenario.ts';
import type { Reparto } from './reparto.ts';

/** Lo que tarda la cámara en volver sola al jugador cuando una escena la dejó en otro lado. */
const DURACION_DE_LA_VUELTA_AL_JUGADOR_EN_SEGUNDOS = 0.6;

export interface PiezasDeCamara {
  readonly escenario: Escenario;
  readonly reparto: Reparto;
  readonly contenido: Contenido;
  /** Los puntos con nombre del mapa: un plano puede apuntar a uno. */
  readonly puntos: Readonly<Record<string, Punto>>;
  /** El decorado del mapa: un plano puede apuntar a un objeto con id. */
  readonly decorado: readonly Decorado[];
  /** A dónde apunta la cámara al empezar un nivel sin jugador. */
  readonly centroDelLugar: Punto;
  /** `true` si el sistema pide menos movimiento: los viajes de cámara se vuelven cortes. */
  readonly conMenosMovimiento: boolean;
}

/** A qué apunta la cámara. */
interface Objetivo {
  /** Lo que se escribió en el paso `camara`. `undefined` = el centro del lugar, en un nivel sin jugador. */
  readonly destino: string | undefined;
  /** Id del personaje al que sigue. `undefined` = apunta a un lugar fijo. */
  readonly personaje: string | undefined;
  /** El lugar fijo. Si sigue a un personaje, es donde la cámara se queda mientras él no esté en el escenario. */
  readonly lugar: Punto;
  readonly ajustes: AjustesDeCamara;
}

/** Un viaje en curso: la cámara va de un encuadre al de su objetivo. */
interface Viaje {
  readonly salida: Encuadre;
  readonly duracionEnSegundos: number;
  segundosTranscurridos: number;
  /** Avisa a quien pidió el viaje de que la cámara ya llegó. */
  readonly alLlegar: () => void;
}

export class CamaraDeEscena {
  private readonly piezas: PiezasDeCamara;
  private objetivo: Objetivo;
  /** El encuadre que la cámara tiene en este cuadro. */
  private encuadre: Encuadre;
  /** `undefined` = la cámara no va de viaje: persigue a su objetivo. */
  private viaje: Viaje | undefined;

  constructor(piezas: PiezasDeCamara) {
    this.piezas = piezas;
    this.objetivo = this.buscarObjetivoInicial();
    // Al empezar, la cámara aparece ya en su lugar, sin recorrido.
    this.encuadre = this.leerEncuadreDelObjetivo();
    this.colocarEnElEscenario();
  }

  /** `true` si la cámara apunta al jugador (o va de camino hacia él). */
  get apuntaAlJugador(): boolean {
    return this.objetivo.destino === CAMARA_AL_JUGADOR;
  }

  /**
   * Corte directo: la cámara salta a apuntar a `destino`, que es el nombre de un plano de `mundo.planos`,
   * el id de un personaje, o `'jugador'`.
   */
  cortarA(destino: string): void {
    this.terminarViaje();
    this.objetivo = this.buscarObjetivo(destino);
    this.encuadre = this.leerEncuadreDelObjetivo();
    this.colocarEnElEscenario();
  }

  /**
   * La cámara viaja con suavidad hasta apuntar a `destino`. La promesa termina cuando llega.
   * Si `senal` se dispara antes, la promesa termina en ese momento y la cámara acaba su viaje sola.
   */
  viajarA(destino: string, duracionEnSegundos: number, senal: AbortSignal): Promise<void> {
    if (duracionEnSegundos <= 0 || this.piezas.conMenosMovimiento) {
      this.cortarA(destino);
      return Promise.resolve();
    }
    if (senal.aborted) {
      return Promise.resolve();
    }

    this.terminarViaje();
    this.objetivo = this.buscarObjetivo(destino);
    return new Promise((terminar) => {
      const alCortarse = (): void => {
        terminar();
      };
      this.viaje = {
        salida: this.encuadre,
        duracionEnSegundos,
        segundosTranscurridos: 0,
        alLlegar: () => {
          senal.removeEventListener('abort', alCortarse);
          terminar();
        },
      };
      senal.addEventListener('abort', alCortarse, { once: true });
    });
  }

  /**
   * Si una escena dejó la cámara apuntando a otro lado, la regresa con suavidad al jugador.
   * En un nivel sin jugador no hace nada: la cámara se queda donde la dejó la escena.
   */
  volverAlJugador(): void {
    if (this.piezas.contenido.jugador === undefined || this.apuntaAlJugador) return;
    // Nadie espera a que este viaje termine, así que su señal nunca se dispara.
    const sinCortar = new AbortController().signal;
    void this.viajarA(CAMARA_AL_JUGADOR, DURACION_DE_LA_VUELTA_AL_JUGADOR_EN_SEGUNDOS, sinCortar);
  }

  /** Se llama en cada cuadro. `segundos` es el tiempo desde el cuadro anterior. */
  actualizar(segundos: number): void {
    const encuadreDelObjetivo = this.leerEncuadreDelObjetivo();
    const viaje = this.viaje;

    if (viaje === undefined) {
      this.encuadre = perseguirEncuadre(this.encuadre, encuadreDelObjetivo, segundos);
      this.colocarEnElEscenario();
      return;
    }

    viaje.segundosTranscurridos += segundos;
    const avance = viaje.segundosTranscurridos / viaje.duracionEnSegundos;
    if (avance >= 1) {
      this.encuadre = encuadreDelObjetivo;
      this.colocarEnElEscenario();
      this.terminarViaje();
      return;
    }
    this.encuadre = mezclarEncuadres(viaje.salida, encuadreDelObjetivo, suavizarAvance(avance));
    this.colocarEnElEscenario();
  }

  private colocarEnElEscenario(): void {
    this.piezas.escenario.enfocar(this.encuadre.punto, this.encuadre.ajustes);
  }

  /** Da por terminado el viaje en curso y avisa a quien lo esperaba. Si no hay viaje, no hace nada. */
  private terminarViaje(): void {
    const viaje = this.viaje;
    if (viaje === undefined) return;
    this.viaje = undefined;
    viaje.alLlegar();
  }

  /** El encuadre al que la cámara quiere llegar: sobre el personaje que sigue, o sobre su lugar fijo. */
  private leerEncuadreDelObjetivo(): Encuadre {
    let punto = this.objetivo.lugar;
    if (this.objetivo.personaje !== undefined) {
      const posicionDelPersonaje = this.piezas.reparto.posicionDe(this.objetivo.personaje);
      if (posicionDelPersonaje !== undefined) {
        punto = posicionDelPersonaje;
      }
    }
    return { punto, ajustes: this.objetivo.ajustes };
  }

  private buscarObjetivoInicial(): Objetivo {
    const camaraDelNivel = this.piezas.contenido.mundo.camara;
    const jugador = this.piezas.contenido.jugador;
    if (jugador === undefined) {
      return { destino: undefined, personaje: undefined, lugar: this.piezas.centroDelLugar, ajustes: camaraDelNivel };
    }
    return {
      destino: CAMARA_AL_JUGADOR,
      personaje: jugador.personaje,
      lugar: this.piezas.centroDelLugar,
      ajustes: camaraDelNivel,
    };
  }

  /** Convierte lo que dice un paso `camara` en el objetivo de la cámara. La validación garantiza que existe. */
  private buscarObjetivo(destino: string): Objetivo {
    const contenido = this.piezas.contenido;
    // Si el personaje al que se apunta no está en el escenario, la cámara se queda mirando donde ya miraba.
    const lugarActual = this.encuadre.punto;

    if (destino === CAMARA_AL_JUGADOR && contenido.jugador !== undefined) {
      return { destino, personaje: contenido.jugador.personaje, lugar: lugarActual, ajustes: contenido.mundo.camara };
    }

    if (Object.hasOwn(contenido.mundo.planos, destino)) {
      const plano = contenido.mundo.planos[destino]!; // `hasOwn` acaba de comprobar que existe
      const ajustes = {
        distanciaEnMetros: plano.distanciaEnMetros,
        alturaEnMetros: plano.alturaEnMetros,
        giroEnGrados: plano.giroEnGrados,
      };
      if (Object.hasOwn(contenido.meta.personajes, plano.mira)) {
        return { destino, personaje: plano.mira, lugar: lugarActual, ajustes };
      }
      return { destino, personaje: undefined, lugar: this.buscarLugarFijo(plano.mira, lugarActual), ajustes };
    }

    // Lo que queda es el id de un personaje: se le sigue con la cámara del nivel.
    return { destino, personaje: destino, lugar: lugarActual, ajustes: contenido.mundo.camara };
  }

  /** El lugar de un punto del mapa o de un objeto del decorado, por su nombre. */
  private buscarLugarFijo(nombre: string, lugarSiNoExiste: Punto): Punto {
    if (Object.hasOwn(this.piezas.puntos, nombre)) {
      return this.piezas.puntos[nombre]!; // `hasOwn` acaba de comprobar que existe
    }
    const objeto = this.piezas.decorado.find((candidato) => candidato.id === nombre);
    if (objeto !== undefined) {
      return centroDeRectangulo(objeto.huella);
    }
    return lugarSiNoExiste;
  }
}
