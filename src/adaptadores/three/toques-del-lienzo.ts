// Escucha el lienzo del escenario y avisa de cada toque: qué tocó el jugador (un personaje, un objeto o el piso).
// Distingue un toque de un arrastre por lo que se movió el dedo entre apoyarlo y soltarlo.

import type { Camera, Object3D } from 'three';
import type { Punto } from '../../dominio/geometria.ts';
import type { Toque } from '../../puertos/escenario.ts';
import { buscarToque } from './buscar-toque.ts';

/**
 * Si el dedo se movió más que esto entre apoyar y soltar, fue un arrastre y no un toque.
 * Es generoso a propósito: un dedo pequeño sobre una tablet resbala bastante más que un ratón.
 */
const MOVIMIENTO_MAXIMO_DE_UN_TOQUE_EN_PUNTOS = 24;

/** Lo que hace falta para saber qué se tocó. */
export interface PiezasDeLosToques {
  readonly lienzo: HTMLCanvasElement;
  readonly camara: Camera;
  /** Los objetos que responden al toque, con el toque que les corresponde. */
  readonly tocables: ReadonlyMap<Object3D, Toque>;
}

export class ToquesDelLienzo {
  private readonly piezas: PiezasDeLosToques;
  private funcionesDeToque: ((toque: Toque) => void)[] = [];
  /** Dónde se apoyó el dedo, para saber al soltarlo si fue un toque o un arrastre. */
  private lugarDondeSeApoyo: Punto | undefined;

  constructor(piezas: PiezasDeLosToques) {
    this.piezas = piezas;
    piezas.lienzo.addEventListener('pointerdown', this.alApoyar);
    piezas.lienzo.addEventListener('pointerup', this.alSoltar);
  }

  /** Avisa de cada toque. Devuelve una función que cancela el aviso. */
  alTocar(funcion: (toque: Toque) => void): () => void {
    this.funcionesDeToque.push(funcion);
    return () => {
      this.funcionesDeToque = this.funcionesDeToque.filter((registrada) => registrada !== funcion);
    };
  }

  /** Deja de escuchar el lienzo. */
  destruir(): void {
    this.piezas.lienzo.removeEventListener('pointerdown', this.alApoyar);
    this.piezas.lienzo.removeEventListener('pointerup', this.alSoltar);
    this.funcionesDeToque = [];
  }

  // Estas dos funciones se guardan como propiedades (y no como métodos) para poder quitarlas
  // después con `removeEventListener`, que necesita exactamente la misma función que se registró.
  private readonly alApoyar = (evento: PointerEvent): void => {
    this.lugarDondeSeApoyo = { x: evento.offsetX, y: evento.offsetY };
  };

  private readonly alSoltar = (evento: PointerEvent): void => {
    const apoyo = this.lugarDondeSeApoyo;
    this.lugarDondeSeApoyo = undefined;
    if (apoyo === undefined) return;

    const movimiento = Math.hypot(evento.offsetX - apoyo.x, evento.offsetY - apoyo.y);
    if (movimiento > MOVIMIENTO_MAXIMO_DE_UN_TOQUE_EN_PUNTOS) return;

    const lienzo = this.piezas.lienzo;
    const lugar = {
      x: evento.offsetX,
      y: evento.offsetY,
      anchoDelLienzo: lienzo.clientWidth,
      altoDelLienzo: lienzo.clientHeight,
    };
    const toque = buscarToque(lugar, this.piezas.camara, this.piezas.tocables);
    if (toque === undefined) return;
    for (const funcion of this.funcionesDeToque) {
      funcion(toque);
    }
  };
}
