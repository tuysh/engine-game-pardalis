// Escribe el archivo `assets.json` y lee `assets.config.json`, los dos archivos del generador de manifiestos.

import type { ConfiguracionDeAssets, Manifiesto } from '../../dominio/manifiesto.ts';
import type { EscritorDeManifiestos } from '../../puertos/escritor-de-manifiestos.ts';
import type { Lectura } from '../../puertos/lector-de-niveles.ts';
import { convertirAssetAJson, esquemaDeConfiguracionDeAssets } from './esquema-de-manifiesto.ts';
import { leerJsonConEsquema } from './leer-json-con-esquema.ts';

const ESPACIOS_DE_SANGRIA = 2;

export class EscritorDeManifiestosDeJson implements EscritorDeManifiestos {
  leerConfiguracion(json: unknown): Lectura<ConfiguracionDeAssets> {
    return leerJsonConEsquema(esquemaDeConfiguracionDeAssets, json);
  }

  /**
   * Las claves se escriben en orden alfabético: así el archivo generado cambia lo menos posible
   * entre una vez y otra, y sus diferencias en git se pueden leer.
   */
  redactarManifiesto(manifiesto: Manifiesto): string {
    const clavesEnOrden = Object.keys(manifiesto).sort();

    const manifiestoEnJson: Record<string, unknown> = {};
    for (const clave of clavesEnOrden) {
      manifiestoEnJson[clave] = convertirAssetAJson(manifiesto[clave]!); // la clave viene de `Object.keys`
    }
    return `${JSON.stringify(manifiestoEnJson, null, ESPACIOS_DE_SANGRIA)}\n`;
  }
}
