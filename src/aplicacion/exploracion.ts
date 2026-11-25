// El control libre del jugador. Hay dos formas de moverlo:
//   - tocar (o hacer clic en) un lugar del piso: su personaje camina hasta ahí, rodeando lo que estorbe
//     (dominio/buscar-camino.ts). Si el lugar no se puede alcanzar, llega lo más cerca que se pueda;
//   - mantener oprimida una dirección en el teclado: camina hacia ese lado mientras se oprime.
//
// Manda la orden más reciente. Oprimir una dirección hace olvidar el lugar que se había tocado; y al revés,
// tocar un lugar (o pedir hablar con alguien) hace que no cuente la dirección que ya estaba oprimida,
// hasta que el jugador la suelte y oprima otra vez.

import { avanzarEnDireccion, avanzarHacia } from '../dominio/caminar.ts';
import type { Avance } from '../dominio/caminar.ts';
import type { Punto } from '../dominio/geometria.ts';
import { buscarCamino } from '../dominio/buscar-camino.ts';
import type { MapaDeCaminos } from '../dominio/rejilla-de-caminos.ts';
import { ajustarAlPiso } from '../dominio/terreno.ts';
import type { Reparto } from './reparto.ts';

const SIN_DIRECCION: Punto = { x: 0, y: 0 };

/** Lo que una exploración necesita para funcionar. */
export interface PiezasDeExploracion {
  readonly reparto: Reparto;
  /** El terreno del nivel y su rejilla, para buscar por dónde caminar. */
  readonly caminos: MapaDeCaminos;
  /** Id del personaje que controla el jugador. Ya debe estar en el reparto. */
  readonly idDelJugador: string;
  readonly velocidadEnMetrosPorSegundo: number;
}

export class Exploracion {
  private readonly piezas: PiezasDeExploracion;
  /** Los puntos por los que le falta pasar, en orden; el último es a donde va. Vacía = está quieto. */
  private ruta: readonly Punto[] = [];
  /** Qué hacer cuando termine la caminata actual. */
  private alTerminarDeCaminar: (() => void) | undefined;
  /**
   * `true` desde que se manda al jugador a un lugar hasta que el teclado queda sin dirección oprimida.
   * Mientras tanto la dirección oprimida no cuenta: si contara, cancelaría la orden que se acaba de dar
   * (por ejemplo, pedir hablar con alguien sin haber soltado todavía la tecla con la que se venía caminando).
   */
  private laDireccionOprimidaEsAnteriorALaOrden = false;

  constructor(piezas: PiezasDeExploracion) {
    this.piezas = piezas;
  }

  get posicion(): Punto {
    // El jugador está en el reparto desde antes de crear la exploración.
    return this.piezas.reparto.posicionDe(this.piezas.idDelJugador)!;
  }

  get estaCaminando(): boolean {
    return this.ruta.length > 0;
  }

  /**
   * Manda al jugador a un punto, rodeando lo que estorbe. Si el punto está fuera del piso, va a la orilla
   * más cercana; si no se puede alcanzar (está dentro de un obstáculo), llega lo más cerca que se pueda.
   * `alTerminar` se llama cuando deja de caminar: porque llegó o porque algo le tapó el paso.
   * No se llama si antes se le manda a otro lugar o se le detiene.
   */
  irA(punto: Punto, alTerminar?: () => void): void {
    const destino = ajustarAlPiso(punto, this.piezas.caminos.terreno);
    const camino = buscarCamino(this.posicion, destino, this.piezas.caminos);
    // Sin camino que buscar (el jugador quedó fuera de la rejilla), va derecho, como antes de tener caminos.
    this.ruta = camino === undefined ? [destino] : camino.puntos;
    this.alTerminarDeCaminar = alTerminar;
    this.laDireccionOprimidaEsAnteriorALaOrden = true;
  }

  /** Deja al jugador quieto donde está. */
  detener(): void {
    this.ruta = [];
    this.alTerminarDeCaminar = undefined;
  }

  /**
   * Avanza lo que corresponde a un cuadro. `segundos` es el tiempo desde el cuadro anterior.
   * `direccionDelTeclado` es la dirección que el jugador mantiene oprimida; si no trae ninguna
   * (los dos ejes en 0), el jugador sigue hacia el lugar que tocó.
   */
  avanzar(segundos: number, direccionDelTeclado: Punto = SIN_DIRECCION): void {
    const hayDireccionDelTeclado = direccionDelTeclado.x !== 0 || direccionDelTeclado.y !== 0;
    if (!hayDireccionDelTeclado) {
      this.laDireccionOprimidaEsAnteriorALaOrden = false;
    }

    if (hayDireccionDelTeclado && !this.laDireccionOprimidaEsAnteriorALaOrden) {
      // El teclado manda: se olvida el lugar tocado y lo que hubiera que hacer al llegar.
      this.detener();
      const distanciaEnMetros = this.piezas.velocidadEnMetrosPorSegundo * segundos;
      const haciaDonde = avanzarEnDireccion(this.posicion, direccionDelTeclado, distanciaEnMetros);
      this.darUnPaso(haciaDonde, segundos);
    } else if (this.ruta.length > 0) {
      this.seguirLaRuta(segundos);
    }
  }

  /** Da un paso hacia el siguiente punto de la ruta. Al pasar por él, sigue con el que viene. */
  private seguirLaRuta(segundos: number): void {
    const siguientePunto = this.ruta[0]!; // quien llama ya comprobó que la ruta no está vacía
    const avance = this.darUnPaso(siguientePunto, segundos);

    if (avance.llego) {
      this.ruta = this.ruta.slice(1);
    }
    const terminoDeCaminar = this.ruta.length === 0 || avance.seAtoro;
    if (!terminoDeCaminar) return;

    const alTerminar = this.alTerminarDeCaminar;
    this.ruta = [];
    this.alTerminarDeCaminar = undefined;
    if (alTerminar !== undefined) {
      alTerminar();
    }
  }

  private darUnPaso(destino: Punto, segundos: number): Avance {
    const distanciaEnMetros = this.piezas.velocidadEnMetrosPorSegundo * segundos;
    const avance = avanzarHacia(this.posicion, destino, distanciaEnMetros, this.piezas.caminos.terreno);

    this.piezas.reparto.mirarHacia(this.piezas.idDelJugador, avance.posicion);
    this.piezas.reparto.mover(this.piezas.idDelJugador, avance.posicion);
    return avance;
  }
}
