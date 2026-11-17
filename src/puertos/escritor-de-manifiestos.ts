// El puerto que conoce el formato de los archivos que usa el generador del manifiesto:
// `assets.config.json` (lo que lee) y `assets.json` (lo que escribe).

import type { ConfiguracionDeAssets, Manifiesto } from '../dominio/manifiesto.ts';
import type { Lectura } from './lector-de-niveles.ts';

export interface EscritorDeManifiestos {
  /** Lee el JSON de un `assets.config.json`. */
  leerConfiguracion(json: unknown): Lectura<ConfiguracionDeAssets>;
  /** El texto completo del archivo `assets.json` para ese manifiesto. */
  redactarManifiesto(manifiesto: Manifiesto): string;
}
