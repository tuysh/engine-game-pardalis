// Esconde y muestra los objetos del decorado que llevan `visibleCuando` en el mapa, según el estado del nivel.
// Se revisa en cada cuadro, pero solo se le avisa al escenario cuando un objeto cambia: así un letrero
// se quita en el mismo momento en que se compra lo que anunciaba, también a media cinemática.

import { estaVisibleElDecorado } from '../dominio/decorado-visible.ts';
import type { Decorado } from '../dominio/mundo.ts';
import type { Escenario } from '../puertos/escenario.ts';
import type { EstadoEnJuego } from './estado-en-juego.ts';

/** Lo que necesita la visibilidad del decorado para saber qué esconder y a quién avisarle. */
export interface PiezasDeLaVisibilidad {
  /** El decorado del mapa, en el mismo orden con que se montó la escenografía. */
  readonly decorado: readonly Decorado[];
  readonly estado: EstadoEnJuego;
  readonly escenario: Escenario;
}

/** Lleva la cuenta de qué objetos con `visibleCuando` se ven y avisa al escenario solo cuando uno cambia. */
export class VisibilidadDelDecorado {
  private readonly piezas: PiezasDeLaVisibilidad;
  /** Si cada objeto se ve ahora, por su lugar en la lista. Al montarse, todo se ve. */
  private readonly seVe: boolean[];

  constructor(piezas: PiezasDeLaVisibilidad) {
    this.piezas = piezas;
    this.seVe = piezas.decorado.map(() => true);
  }

  /** Esconde lo que ya no debe verse y muestra lo que sí. Se llama antes del primer cuadro y luego en cada uno. */
  actualizar(): void {
    const decorado = this.piezas.decorado;
    for (let indice = 0; indice < decorado.length; indice++) {
      const objeto = decorado[indice]!; // `indice` es menor que el largo de la lista
      if (objeto.visibleCuando === undefined) continue;

      const debeVerse = estaVisibleElDecorado(objeto, this.piezas.estado.actual);
      if (debeVerse === this.seVe[indice]) continue;
      this.seVe[indice] = debeVerse;
      this.piezas.escenario.cambiarVisibilidadDelDecorado(indice, { esVisible: debeVerse });
    }
  }
}
