// Lector de niveles falso para las pruebas: no revisa nada.
// Entrega las lecturas que la prueba le preparó, sin mirar el JSON que recibe.
// Así una prueba de la aplicación puede trabajar con tipos del dominio sin depender de Zod.

import type { Contenido } from '../../dominio/contenido.ts';
import type { DescripcionDeNivel } from '../../dominio/descripcion-de-nivel.ts';
import type { Manifiesto } from '../../dominio/manifiesto.ts';
import type { Lectura, LectorDeNiveles } from '../../puertos/lector-de-niveles.ts';

/** Lo que el lector falso va a responder. */
export interface LecturasPreparadas {
  readonly descripcion: Lectura<DescripcionDeNivel>;
  readonly contenido: Lectura<Contenido>;
  /** Lo que responde para cualquier `assets.json`. Si se omite, un manifiesto vacío. */
  readonly manifiesto?: Lectura<Manifiesto>;
}

export class LectorDeNivelesDeMemoria implements LectorDeNiveles {
  private readonly lecturas: LecturasPreparadas;

  constructor(lecturas: LecturasPreparadas) {
    this.lecturas = lecturas;
  }

  leerDescripcionDeNivel(json: unknown): Lectura<DescripcionDeNivel> {
    return this.lecturas.descripcion;
  }

  leerContenido(json: unknown): Lectura<Contenido> {
    return this.lecturas.contenido;
  }

  leerManifiesto(json: unknown): Lectura<Manifiesto> {
    if (this.lecturas.manifiesto === undefined) {
      return { tipo: 'leido', valor: {} };
    }
    return this.lecturas.manifiesto;
  }
}
