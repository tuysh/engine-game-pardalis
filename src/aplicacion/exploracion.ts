// El control libre del jugador: toca un lugar del piso y su personaje camina hasta ahí,
// con la cámara siguiéndolo.

import { avanzarHacia } from '../dominio/caminar.ts';
import type { AjustesDeCamara } from '../dominio/contenido.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Mira } from '../dominio/mundo.ts';
import { ajustarAlPiso } from '../dominio/terreno.ts';
import type { Terreno } from '../dominio/terreno.ts';
import type { Escenario } from '../puertos/escenario.ts';

/** Lo que una exploración necesita para funcionar. */
export interface PiezasDeExploracion {
  readonly escenario: Escenario;
  readonly terreno: Terreno;
  /** Id del personaje que controla el jugador. Ya debe estar en el escenario. */
  readonly idDelJugador: string;
  readonly posicionInicial: Punto;
  readonly miraInicial: Mira;
  readonly velocidadEnMetrosPorSegundo: number;
  readonly camara: AjustesDeCamara;
}

export class Exploracion {
  private readonly piezas: PiezasDeExploracion;
  private posicionActual: Punto;
  private miraActual: Mira;
  /** A dónde va caminando. `undefined` = está quieto. */
  private destino: Punto | undefined;

  constructor(piezas: PiezasDeExploracion) {
    this.piezas = piezas;
    this.posicionActual = piezas.posicionInicial;
    this.miraActual = piezas.miraInicial;
    // Al empezar, la cámara aparece ya sobre el jugador, sin recorrido.
    piezas.escenario.enfocar(this.posicionActual, piezas.camara, { deInmediato: true });
  }

  get posicion(): Punto {
    return this.posicionActual;
  }

  get estaCaminando(): boolean {
    return this.destino !== undefined;
  }

  /** Manda al jugador a un punto. Si el punto está fuera del piso, va a la orilla más cercana. */
  irA(punto: Punto): void {
    this.destino = ajustarAlPiso(punto, this.piezas.terreno);
  }

  /** Deja al jugador quieto donde está. */
  detener(): void {
    this.destino = undefined;
  }

  /** Avanza lo que corresponde a un cuadro. `segundos` es el tiempo desde el cuadro anterior. */
  avanzar(segundos: number): void {
    if (this.destino === undefined) return;

    const distanciaEnMetros = this.piezas.velocidadEnMetrosPorSegundo * segundos;
    const avance = avanzarHacia(this.posicionActual, this.destino, distanciaEnMetros, this.piezas.terreno);

    this.mirarHaciaDondeCamina(avance.posicion);
    this.posicionActual = avance.posicion;
    this.piezas.escenario.moverPersonaje(this.piezas.idDelJugador, this.posicionActual);
    this.piezas.escenario.enfocar(this.posicionActual, this.piezas.camara, { deInmediato: false });

    if (avance.llego || avance.seAtoro) {
      this.destino = undefined;
    }
  }

  /** Voltea al personaje si empezó a moverse hacia el otro lado. Al caminar solo de fondo no cambia. */
  private mirarHaciaDondeCamina(posicionNueva: Punto): void {
    let miraNueva = this.miraActual;
    if (posicionNueva.x > this.posicionActual.x) {
      miraNueva = 'derecha';
    } else if (posicionNueva.x < this.posicionActual.x) {
      miraNueva = 'izquierda';
    }

    if (miraNueva !== this.miraActual) {
      this.miraActual = miraNueva;
      this.piezas.escenario.voltearPersonaje(this.piezas.idDelJugador, miraNueva);
    }
  }
}
