// Guarda el estado del nivel mientras se juega y avisa cuando se cumple un objetivo.
//
// El estado del dominio (`EstadoDeNivel`) nunca cambia: cada cambio produce uno nuevo.
// Esta clase es quien recuerda cuál es el actual.

import { calcularCambios, conCambios, objetivosRecienCumplidos } from '../dominio/estado.ts';
import type { CambiosDeEstado, EstadoDeNivel } from '../dominio/estado.ts';

export class EstadoEnJuego {
  private estadoActual: EstadoDeNivel;
  private readonly alCumplirObjetivo: (objetivo: string) => void;

  /** `alCumplirObjetivo` se llama una vez por cada objetivo que pasa de no cumplido a cumplido. */
  constructor(estadoInicial: EstadoDeNivel, alCumplirObjetivo: (objetivo: string) => void) {
    this.estadoActual = estadoInicial;
    this.alCumplirObjetivo = alCumplirObjetivo;
  }

  /** El estado en este momento. */
  get actual(): EstadoDeNivel {
    return this.estadoActual;
  }

  /** Cambia variables. Ejemplo: `aplicar({ tortillas: true, dinero: { resta: 10 } })`. */
  aplicar(cambios: CambiosDeEstado): void {
    const estadoAnterior = this.estadoActual;
    this.estadoActual = conCambios(estadoAnterior, calcularCambios(estadoAnterior, cambios));

    for (const objetivo of objetivosRecienCumplidos(estadoAnterior, this.estadoActual)) {
      this.alCumplirObjetivo(objetivo);
    }
  }
}
