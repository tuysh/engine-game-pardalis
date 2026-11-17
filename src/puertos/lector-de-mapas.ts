// El puerto que convierte el archivo de un mapa en el `Mundo` del dominio.

import type { Diagnostico } from '../dominio/diagnostico.ts';
import type { Mundo } from '../dominio/mundo.ts';

export interface LectorDeMapas {
  /**
   * Lee el JSON de un mapa tal como llega de afuera. Las medidas del mapa vienen en píxeles
   * y se convierten a metros con `pixelesPorMetro`.
   *
   * Los problemas se anotan en `diagnostico`, cada uno nombrando la capa o el objeto del mapa.
   * Devuelve `undefined` si el archivo no es un mapa que se pueda leer.
   */
  leerMundo(json: unknown, pixelesPorMetro: number, diagnostico: Diagnostico): Mundo | undefined;
}
