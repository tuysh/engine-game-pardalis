// Cargador que trae archivos por la red con `fetch`. Es el que usa el juego en el navegador.
// Solo pide archivos al mismo sitio de la página o a los orígenes que el host permitió.
//
// No tiene pruebas automáticas porque necesita un navegador (`location`); la regla de qué direcciones
// se permiten sí las tiene, en src/dominio/direccion-permitida.test.ts.

import { esDireccionPermitida } from '../../dominio/direccion-permitida.ts';
import { ErrorDeEscenario } from '../../dominio/error-de-escenario.ts';
import type { Cargador } from '../../puertos/cargador.ts';

export class CargadorDeRed implements Cargador {
  private readonly origenesPermitidos: readonly string[];

  /** `origenesPermitidos` son los orígenes HTTPS externos de los que se pueden traer archivos (el CDN). */
  constructor(origenesPermitidos: readonly string[]) {
    this.origenesPermitidos = origenesPermitidos;
  }

  async cargarJson(direccion: string): Promise<unknown> {
    const direccionCompleta = this.completarYComprobar(direccion);

    let respuesta: Response;
    try {
      respuesta = await fetch(direccionCompleta);
    } catch (error) {
      throw new ErrorDeEscenario([`no se pudo cargar ${direccion}: ${describirError(error)}`]);
    }
    if (!respuesta.ok) {
      throw new ErrorDeEscenario([`no se pudo cargar ${direccion} (el servidor respondió ${respuesta.status})`]);
    }

    try {
      const json: unknown = await respuesta.json();
      return json;
    } catch (error) {
      throw new ErrorDeEscenario([`${direccion} no es JSON válido: ${describirError(error)}`]);
    }
  }

  /** La dirección que resulta ya viene comprobada: si no está permitida, rechaza con `ErrorDeEscenario`. */
  resolverJuntoA(direccionBase: string, rutaRelativa: string): string {
    const baseCompleta = new URL(direccionBase, location.href);
    const direccion = new URL(rutaRelativa, baseCompleta).href;
    return this.completarYComprobar(direccion);
  }

  private completarYComprobar(direccion: string): string {
    if (!esDireccionPermitida(direccion, location.href, this.origenesPermitidos)) {
      throw new ErrorDeEscenario([
        `dirección no permitida: ${direccion}; solo se cargan archivos del mismo sitio ` +
          'o de los orígenes HTTPS de "origenesPermitidos"',
      ]);
    }
    return new URL(direccion, location.href).href;
  }
}

function describirError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
