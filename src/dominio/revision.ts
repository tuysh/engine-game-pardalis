// Los datos que comparten todas las revisiones de un contenido mientras se valida.

import type { Contenido } from './contenido.ts';
import type { Diagnostico } from './diagnostico.ts';

export interface Revision {
  readonly contenido: Contenido;
  /** Nombres de variables que una condición o un paso `pon` pueden usar. */
  readonly variablesDeclaradas: ReadonlySet<string>;
  /**
   * Nombres de los minijuegos que registró el host.
   * `undefined` = no se sabe (por ejemplo, al validar desde la línea de comandos sin decirlos), así que no se revisan.
   */
  readonly minijuegos?: readonly string[];
  /** Nombres de las cinemáticas en código que registró el host. `undefined` = no se sabe, así que no se revisan. */
  readonly cinematicasEnCodigo?: readonly string[];
  /** Donde se anotan los errores y las advertencias. */
  readonly diagnostico: Diagnostico;
}
