// Los controles del jugador con el teclado: las flechas o las teclas W, A, S y D para caminar,
// y E, Enter o la barra espaciadora para hablar con quien tenga cerca.
//
// Las teclas se reconocen por su lugar en el teclado (`code`) y no por la letra que escriben (`key`):
// así W, A, S y D quedan bajo los mismos dedos también en teclados con otra distribución.
//
// Se verifica a mano en la demo; no tiene pruebas automáticas porque necesita un navegador.

import type { Controles, DireccionDeControl } from '../../puertos/controles.ts';

/** Qué eje y qué sentido mueve cada tecla. */
const MOVIMIENTO_POR_TECLA: Readonly<Record<string, DireccionDeControl>> = {
  KeyW: { x: 0, y: -1 },
  ArrowUp: { x: 0, y: -1 },
  KeyS: { x: 0, y: 1 },
  ArrowDown: { x: 0, y: 1 },
  KeyA: { x: -1, y: 0 },
  ArrowLeft: { x: -1, y: 0 },
  KeyD: { x: 1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
};

/** Las teclas que piden hablar, por su `code`. */
const TECLAS_DE_HABLAR: readonly string[] = ['KeyE', 'Enter', 'Space'];

export class ControlesDelTeclado implements Controles {
  /** Las teclas de movimiento que están oprimidas ahora, por su `code`. */
  private readonly teclasOprimidas = new Set<string>();
  private funcionesDeHablar: (() => void)[] = [];
  private estanDestruidos = false;

  constructor() {
    window.addEventListener('keydown', this.alOprimir);
    window.addEventListener('keyup', this.alSoltar);
    // Si la ventana pierde el foco con una tecla oprimida, nunca llega el aviso de que se soltó.
    window.addEventListener('blur', this.alPerderElFoco);
  }

  leerDireccion(): DireccionDeControl {
    let x = 0;
    let y = 0;
    for (const tecla of this.teclasOprimidas) {
      const movimiento = MOVIMIENTO_POR_TECLA[tecla]!; // solo se guardan teclas que están en la tabla
      x += movimiento.x;
      y += movimiento.y;
    }
    // Dos teclas del mismo lado (W y flecha arriba) cuentan como una; dos opuestas se anulan.
    return { x: Math.sign(x), y: Math.sign(y) };
  }

  alPedirHablar(funcion: () => void): () => void {
    this.funcionesDeHablar.push(funcion);
    return () => {
      this.funcionesDeHablar = this.funcionesDeHablar.filter((registrada) => registrada !== funcion);
    };
  }

  destruir(): void {
    if (this.estanDestruidos) return;
    this.estanDestruidos = true;
    this.funcionesDeHablar = [];
    window.removeEventListener('keydown', this.alOprimir);
    window.removeEventListener('keyup', this.alSoltar);
    window.removeEventListener('blur', this.alPerderElFoco);
    this.teclasOprimidas.clear();
  }

  // Estas funciones se guardan como propiedades (y no como métodos) para poder quitarlas
  // después con `removeEventListener`, que necesita exactamente la misma función que se registró.
  private readonly alOprimir = (evento: KeyboardEvent): void => {
    // Si el host tiene un campo de texto y la persona está escribiendo, sus teclas no son para el juego.
    if (estaEscribiendo(evento)) return;

    if (Object.hasOwn(MOVIMIENTO_POR_TECLA, evento.code)) {
      this.teclasOprimidas.add(evento.code);
      // Evita que las flechas, además de mover al personaje, desplacen la página.
      evento.preventDefault();
      return;
    }

    // `repeat` es verdadero en los avisos que el teclado repite al dejar una tecla oprimida: se pide hablar una vez.
    const pideHablar = TECLAS_DE_HABLAR.includes(evento.code) && !evento.repeat;
    if (pideHablar && this.funcionesDeHablar.length > 0) {
      // Evita que la barra espaciadora, además, desplace la página.
      evento.preventDefault();
      for (const funcion of [...this.funcionesDeHablar]) {
        funcion();
      }
    }
  };

  private readonly alSoltar = (evento: KeyboardEvent): void => {
    this.teclasOprimidas.delete(evento.code);
  };

  private readonly alPerderElFoco = (): void => {
    this.teclasOprimidas.clear();
  };
}

function estaEscribiendo(evento: KeyboardEvent): boolean {
  const destino = evento.target;
  if (!(destino instanceof HTMLElement)) return false;
  return destino.isContentEditable || destino instanceof HTMLInputElement || destino instanceof HTMLTextAreaElement;
}
