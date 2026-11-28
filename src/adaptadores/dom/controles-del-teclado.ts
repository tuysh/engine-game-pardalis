// Los controles del jugador con el teclado: las flechas o las teclas W, A, S y D para caminar,
// y E, Enter o la barra espaciadora para hablar con quien tenga cerca.
//
// Enter o la barra espaciadora oprimidas en un control de la página (un botón del host, una tarjeta de
// opciones, algo dentro de un minijuego o de un diálogo del host) son de ese control: aquí no se cancelan
// ni piden hablar. `E` sí habla con el foco en un botón (tras tocar la bocina, por ejemplo), pero no dentro
// de un minijuego o de un diálogo del host, que tapan a quien está detrás; ahí tampoco las flechas mueven
// al jugador.
//
// Las teclas se reconocen por su lugar en el teclado (`code`) y no por la letra que escriben (`key`):
// así W, A, S y D quedan bajo los mismos dedos también en teclados con otra distribución.
//
// Se verifica a mano en la demo; la decisión de qué tecla es de un control se prueba en
// `tecla-de-un-control.test.ts`.

import type { Controles, DireccionDeControl } from '../../puertos/controles.ts';
import { esTeclaDeUnCampo, esTeclaDeUnControl, esTeclaDeUnaVentana } from './tecla-de-un-control.ts';

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

/** Las teclas de hablar que, además, oprimen el botón que tiene el foco. */
const TECLAS_QUE_OPRIMEN_BOTONES: readonly string[] = ['Enter', 'Space'];

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
    const camino = evento.composedPath();
    // Si el host tiene un campo de texto y la persona está escribiendo, sus teclas no son para el juego.
    if (esTeclaDeUnCampo(camino)) return;
    // Dentro de un minijuego o de un diálogo del host las teclas son de esa ventana: las flechas no mueven al
    // jugador que quedó detrás (ni se cancelan, por si la ventana las usa) y `E` no pide hablar con nadie.
    if (esTeclaDeUnaVentana(camino)) return;

    if (Object.hasOwn(MOVIMIENTO_POR_TECLA, evento.code)) {
      this.teclasOprimidas.add(evento.code);
      // Evita que las flechas, además de mover al personaje, desplacen la página.
      evento.preventDefault();
      return;
    }

    // `repeat` es verdadero en los avisos que el teclado repite al dejar una tecla oprimida: se pide hablar una vez.
    const esTeclaDeHablar = TECLAS_DE_HABLAR.includes(evento.code) && !evento.repeat;
    // En un botón, Enter y la barra espaciadora lo oprimen. Cancelarlas aquí lo dejaría sin funcionar con
    // teclado, y pedir hablar empezaría una plática con quien está cerca que nadie pidió.
    if (TECLAS_QUE_OPRIMEN_BOTONES.includes(evento.code) && esTeclaDeUnControl(camino)) return;
    // Enter y la barra espaciadora también siguen el diálogo, y la interfaz las atiende antes (escucha en
    // `document`, que recibe la tecla antes que `window`) y lo marca con `preventDefault`. Si esa tecla cerró
    // la última línea, aquí el diálogo ya terminó: pedir hablar lo empezaría otra vez con quien está cerca.
    const yaLaAtendioLaInterfaz = evento.defaultPrevented;
    const pideHablar = esTeclaDeHablar && !yaLaAtendioLaInterfaz;
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
