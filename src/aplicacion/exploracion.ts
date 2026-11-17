// El control libre del jugador: toca un lugar del piso y su personaje camina hasta ahí,
// con la cámara siguiéndolo.

import { avanzarHacia } from '../dominio/caminar.ts';
import type { AjustesDeCamara } from '../dominio/contenido.ts';
import type { Punto } from '../dominio/geometria.ts';
import { ajustarAlPiso } from '../dominio/terreno.ts';
import type { Terreno } from '../dominio/terreno.ts';
import type { Escenario } from '../puertos/escenario.ts';
import type { Reparto } from './reparto.ts';

/** Lo que una exploración necesita para funcionar. */
export interface PiezasDeExploracion {
  readonly escenario: Escenario;
  readonly reparto: Reparto;
  readonly terreno: Terreno;
  /** Id del personaje que controla el jugador. Ya debe estar en el reparto. */
  readonly idDelJugador: string;
  readonly velocidadEnMetrosPorSegundo: number;
  readonly camara: AjustesDeCamara;
}

export class Exploracion {
  private readonly piezas: PiezasDeExploracion;
  /** A dónde va caminando. `undefined` = está quieto. */
  private destino: Punto | undefined;
  /** Qué hacer cuando termine la caminata actual. */
  private alTerminarDeCaminar: (() => void) | undefined;

  constructor(piezas: PiezasDeExploracion) {
    this.piezas = piezas;
    // Al empezar, la cámara aparece ya sobre el jugador, sin recorrido.
    piezas.escenario.enfocar(this.posicion, piezas.camara, { deInmediato: true });
  }

  get posicion(): Punto {
    // El jugador está en el reparto desde antes de crear la exploración.
    return this.piezas.reparto.posicionDe(this.piezas.idDelJugador)!;
  }

  get estaCaminando(): boolean {
    return this.destino !== undefined;
  }

  /**
   * Manda al jugador a un punto. Si el punto está fuera del piso, va a la orilla más cercana.
   * `alTerminar` se llama cuando deja de caminar: porque llegó o porque algo le tapó el paso.
   * No se llama si antes se le manda a otro lugar o se le detiene.
   */
  irA(punto: Punto, alTerminar?: () => void): void {
    this.destino = ajustarAlPiso(punto, this.piezas.terreno);
    this.alTerminarDeCaminar = alTerminar;
  }

  /** Deja al jugador quieto donde está. */
  detener(): void {
    this.destino = undefined;
    this.alTerminarDeCaminar = undefined;
  }

  /** Avanza lo que corresponde a un cuadro. `segundos` es el tiempo desde el cuadro anterior. */
  avanzar(segundos: number): void {
    if (this.destino !== undefined) {
      this.darUnPaso(this.destino, segundos);
    }
    // La cámara sigue al jugador siempre, también cuando lo mueve un diálogo y no el propio jugador.
    this.piezas.escenario.enfocar(this.posicion, this.piezas.camara, { deInmediato: false });
  }

  private darUnPaso(destino: Punto, segundos: number): void {
    const distanciaEnMetros = this.piezas.velocidadEnMetrosPorSegundo * segundos;
    const avance = avanzarHacia(this.posicion, destino, distanciaEnMetros, this.piezas.terreno);

    this.piezas.reparto.mirarHacia(this.piezas.idDelJugador, avance.posicion);
    this.piezas.reparto.mover(this.piezas.idDelJugador, avance.posicion);

    if (avance.llego || avance.seAtoro) {
      const alTerminar = this.alTerminarDeCaminar;
      this.destino = undefined;
      this.alTerminarDeCaminar = undefined;
      if (alTerminar !== undefined) {
        alTerminar();
      }
    }
  }
}
