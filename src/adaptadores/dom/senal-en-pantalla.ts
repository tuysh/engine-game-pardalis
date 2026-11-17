// Una señal que se coloca sobre un lugar de la pantalla y lo sigue: la flecha de la salida
// y el aviso de que hay algo a la mano. Las dos son un dibujo que sube y baja; no atrapan toques.

import type { LugarEnPantalla } from '../../puertos/escenario.ts';
import { crearOculto } from './elementos.ts';

export class SenalEnPantalla {
  readonly elemento: HTMLElement;

  /** `clase` es la clase de CSS que le da su apariencia (`flecha`, `aviso`). */
  constructor(clase: string) {
    this.elemento = crearOculto('div', clase);
  }

  get estaVisible(): boolean {
    return !this.elemento.hidden;
  }

  /** Muestra la señal con ese contenido (su dibujo y, si acaso, una leyenda). */
  mostrar(contenido: readonly Node[]): void {
    this.elemento.replaceChildren(...contenido);
    this.elemento.hidden = false;
  }

  /** Pone la punta de la señal (el centro de su borde de abajo) en ese lugar. */
  apuntar(lugar: LugarEnPantalla): void {
    this.elemento.style.transform = `translate(${lugar.x}px, ${lugar.y}px) translate(-50%, -100%)`;
  }

  ocultar(): void {
    this.elemento.hidden = true;
  }
}
