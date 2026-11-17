// Los assets de un nivel: la unión de los manifiestos de todas sus carpetas de assets.
//
// `nivel.json` lista las carpetas en orden, por ejemplo `[".", "../comun"]`. Si la misma clave está
// en dos carpetas, gana la que aparece primero y se advierte: así un nivel puede reemplazar a propósito
// un asset común, sin que pase inadvertido.

import type { Diagnostico } from './diagnostico.ts';
import type { Asset, Manifiesto } from './manifiesto.ts';

/** Un asset junto con la carpeta de donde sale. */
export interface AssetUbicado {
  readonly asset: Asset;
  /** La carpeta de assets, tal como la nombra `nivel.json`. Ejemplo: `"../comun"`. */
  readonly carpeta: string;
}

/** Todos los assets que un nivel puede usar, por clave. */
export type AssetsDeNivel = Readonly<Record<string, AssetUbicado>>;

/** El manifiesto de una de las carpetas de assets del nivel. */
export interface ManifiestoDeCarpeta {
  readonly carpeta: string;
  readonly manifiesto: Manifiesto;
}

/** Une los manifiestos en el orden recibido. Anota una advertencia por cada clave repetida. */
export function unirManifiestos(manifiestos: readonly ManifiestoDeCarpeta[], diagnostico: Diagnostico): AssetsDeNivel {
  const assets: Record<string, AssetUbicado> = {};

  for (const { carpeta, manifiesto } of manifiestos) {
    for (const clave of Object.keys(manifiesto)) {
      // Guardar la clave "__proto__" cambiaría el prototipo del objeto en vez de agregar un asset.
      if (clave === '__proto__') continue;

      if (Object.hasOwn(assets, clave)) {
        const carpetaQueGana = assets[clave]!.carpeta; // `hasOwn` acaba de comprobar que existe
        diagnostico.advertencias.push(
          `el asset "${clave}" está en las carpetas "${carpetaQueGana}" y "${carpeta}"; se usa el de "${carpetaQueGana}"`,
        );
        continue;
      }
      assets[clave] = { asset: manifiesto[clave]!, carpeta }; // la clave viene de `Object.keys(manifiesto)`
    }
  }
  return assets;
}
