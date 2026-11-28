// Guarda el estado del nivel mientras se juega, y avisa cuando una variable cambia y cuando se cumple un objetivo.
//
// El estado del dominio (`EstadoDeNivel`) nunca cambia: cada cambio produce uno nuevo.
// Esta clase es quien recuerda cuál es el actual.

import { calcularCambios, conCambios, objetivosRecienCumplidos, valorDe } from '../dominio/estado.ts';
import type { CambiosDeEstado, EstadoDeNivel, ValorDeEstado, VariablesDeEstado } from '../dominio/estado.ts';

export class EstadoEnJuego {
  private estadoActual: EstadoDeNivel;
  private readonly alCumplirObjetivo: (objetivo: string) => void;
  private readonly alCambiar: (cambios: VariablesDeEstado) => void;

  /**
   * `alCumplirObjetivo` se llama una vez por cada objetivo que pasa de no cumplido a cumplido.
   * `alCambiar` se llama cada vez que alguna variable queda con otro valor, con las que cambiaron y su valor
   * nuevo. Si no se entrega, nadie se entera de los cambios.
   */
  constructor(
    estadoInicial: EstadoDeNivel,
    alCumplirObjetivo: (objetivo: string) => void,
    alCambiar: (cambios: VariablesDeEstado) => void = () => {},
  ) {
    this.estadoActual = estadoInicial;
    this.alCumplirObjetivo = alCumplirObjetivo;
    this.alCambiar = alCambiar;
  }

  /** El estado en este momento. */
  get actual(): EstadoDeNivel {
    return this.estadoActual;
  }

  /**
   * Cambia variables. Ejemplo: `aplicar({ tortillas: true, dinero: { resta: 10 } })`.
   * Devuelve solo las variables que quedaron con otro valor, con su valor nuevo (las mismas que recibe `alCambiar`).
   */
  aplicar(cambios: CambiosDeEstado): VariablesDeEstado {
    const estadoAnterior = this.estadoActual;
    const valoresNuevos = calcularCambios(estadoAnterior, cambios);
    this.estadoActual = conCambios(estadoAnterior, valoresNuevos);

    // Volver a poner el valor que una variable ya tenía no es un cambio: de eso no se avisa.
    const loQueCambio: Record<string, ValorDeEstado> = {};
    for (const nombre of Object.keys(valoresNuevos)) {
      const valorNuevo = valoresNuevos[nombre]!; // `nombre` viene de `Object.keys`, así que existe
      if (valorDe(estadoAnterior, nombre) !== valorNuevo) {
        loQueCambio[nombre] = valorNuevo;
      }
    }
    if (Object.keys(loQueCambio).length > 0) {
      this.alCambiar(loQueCambio);
    }

    for (const objetivo of objetivosRecienCumplidos(estadoAnterior, this.estadoActual)) {
      this.alCumplirObjetivo(objetivo);
    }
    return loQueCambio;
  }
}
