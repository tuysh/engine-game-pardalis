// Controles falsos para las pruebas: la prueba decide qué dirección «está oprimida».

import type { Controles, DireccionDeControl } from '../../puertos/controles.ts';

export class ControlesDeMemoria implements Controles {
  /** La dirección que se entrega. La prueba la cambia para simular que se oprimen o se sueltan teclas. */
  direccion: DireccionDeControl = { x: 0, y: 0 };
  estanDestruidos = false;

  leerDireccion(): DireccionDeControl {
    return this.direccion;
  }

  destruir(): void {
    this.estanDestruidos = true;
  }
}
