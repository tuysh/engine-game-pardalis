// El error con el que el motor avisa que no pudo arrancar o continuar.
// Lleva la lista completa de problemas, para que quien escribe niveles los vea todos de una vez.

/**
 * Error del motor. `problemas` trae un mensaje por cada problema encontrado,
 * cada uno con la ruta del JSON o el objeto del mapa donde está.
 *
 * @example
 * try {
 *   await crearEscenario(elemento, opciones);
 * } catch (error) {
 *   if (error instanceof ErrorDeEscenario) console.error(error.problemas.join('\n'));
 * }
 */
// `extends Error` es la excepción a «composición, no herencia»:
// JavaScript solo conserva la pila de llamadas en los objetos que heredan de `Error`.
export class ErrorDeEscenario extends Error {
  readonly problemas: readonly string[];

  constructor(problemas: readonly string[]) {
    super(redactarMensaje(problemas));
    this.name = 'ErrorDeEscenario';
    this.problemas = problemas;
  }
}

function redactarMensaje(problemas: readonly string[]): string {
  if (problemas.length === 0) {
    return '[escenario-engine] error sin detalle';
  }
  if (problemas.length === 1) {
    return `[escenario-engine] ${problemas[0]}`;
  }
  const lineas = problemas.map((problema) => `  - ${problema}`);
  return `[escenario-engine] ${problemas.length} problemas:\n${lineas.join('\n')}`;
}

/** El mensaje de un error cualquiera, para ponerlo dentro de otro mensaje. */
export function describirError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/**
 * Convierte un error cualquiera en un `ErrorDeEscenario`, que es el único que el motor le entrega al host.
 * Si ya lo es, lo devuelve tal cual, con todos sus problemas.
 */
export function convertirEnErrorDeEscenario(error: unknown): ErrorDeEscenario {
  if (error instanceof ErrorDeEscenario) return error;
  return new ErrorDeEscenario([describirError(error)]);
}
