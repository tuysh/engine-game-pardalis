// Lector de mapas falso para las pruebas: no lee nada.
// Entrega el mundo que la prueba le preparó, sin mirar el JSON que recibe.

import type { Diagnostico } from '../../dominio/diagnostico.ts';
import type { Mundo } from '../../dominio/mundo.ts';
import type { LectorDeMapas } from '../../puertos/lector-de-mapas.ts';

export class LectorDeMapasDeMemoria implements LectorDeMapas {
  private readonly mundo: Mundo | undefined;
  private readonly errores: readonly string[];

  /**
   * `mundo` es lo que va a responder. Con `undefined` se comporta como ante un archivo que no es un mapa:
   * anota `errores` y no entrega mundo.
   */
  constructor(mundo: Mundo | undefined, errores: readonly string[] = []) {
    this.mundo = mundo;
    this.errores = errores;
  }

  leerMundo(json: unknown, pixelesPorMetro: number, diagnostico: Diagnostico): Mundo | undefined {
    diagnostico.errores.push(...this.errores);
    return this.mundo;
  }
}
