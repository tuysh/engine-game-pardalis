// Controles falsos para las pruebas: la prueba decide qué dirección «está oprimida».

import type { Controles, DireccionDeControl } from '../../puertos/controles.ts';

export class ControlesDeMemoria implements Controles {
  /** La dirección que se entrega. La prueba la cambia para simular que se oprimen o se sueltan teclas. */
  direccion: DireccionDeControl = { x: 0, y: 0 };
  estanDestruidos = false;
  private funcionesDeHablar: (() => void)[] = [];

  leerDireccion(): DireccionDeControl {
    return this.direccion;
  }

  alPedirHablar(funcion: () => void): () => void {
    this.funcionesDeHablar.push(funcion);
    return () => {
      this.funcionesDeHablar = this.funcionesDeHablar.filter((registrada) => registrada !== funcion);
    };
  }

  destruir(): void {
    this.estanDestruidos = true;
  }

  /** Para las pruebas: hace como si el jugador hubiera oprimido la tecla de hablar. */
  simularTeclaDeHablar(): void {
    for (const funcion of [...this.funcionesDeHablar]) {
      funcion();
    }
  }
}
