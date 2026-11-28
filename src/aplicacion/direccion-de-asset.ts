// Calcula la dirección completa de un archivo de assets de un nivel: junto a su `nivel.json`,
// o bajo `raizDeAssets` si el host la dio (docs/DISENO-3.0.md §8.3).

import type { AssetsDeNivel } from '../dominio/assets-de-nivel.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { rutaDesdeLaRaizDeAssets } from '../dominio/ruta-desde-la-raiz-de-assets.ts';
import type { Cargador } from '../puertos/cargador.ts';
import type { CuadrosDeAsset } from '../puertos/minijuego.ts';

/** De dónde salen los assets de un nivel. */
export interface UbicacionDeAssets {
  /** Dirección del `nivel.json`: las carpetas de assets son relativas a él. */
  readonly direccionDelNivel: string;
  /** Carpeta o CDN que reemplaza a la carpeta de los niveles. `undefined` = junto a cada `nivel.json`. */
  readonly raizDeAssets?: string;
  readonly cargador: Cargador;
}

/**
 * `carpeta` es una de las carpetas de assets que lista `nivel.json` (por ejemplo `"."` o `"../comun"`)
 * y `archivo` es una ruta dentro de ella (por ejemplo `"img/spr_tortu.svg"`).
 */
export function direccionDeArchivoDeAssets(carpeta: string, archivo: string, ubicacion: UbicacionDeAssets): string {
  if (ubicacion.raizDeAssets === undefined) {
    return ubicacion.cargador.resolverJuntoA(ubicacion.direccionDelNivel, `${carpeta}/${archivo}`);
  }

  const ruta = rutaDesdeLaRaizDeAssets(ubicacion.direccionDelNivel, carpeta, archivo);
  if (ruta === undefined) {
    throw new ErrorDeEscenario([
      `la carpeta de assets "${carpeta}" se sale de raizDeAssets; con raizDeAssets, las carpetas de assets ` +
        'deben ser la del nivel o hermanas de ella (como "../comun")',
    ]);
  }
  // La raíz debe terminar en "/" para que se entienda como carpeta y no como archivo.
  let raizComoCarpeta = ubicacion.raizDeAssets;
  if (!raizComoCarpeta.endsWith('/')) {
    raizComoCarpeta += '/';
  }
  return ubicacion.cargador.resolverJuntoA(raizComoCarpeta, ruta);
}

/**
 * La dirección completa de un asset por su clave. De una animación, la de su primer cuadro.
 * Devuelve `undefined` si la clave no está en los assets del nivel (por ejemplo, una voz sin grabar).
 */
export function buscarDireccionDeAsset(
  clave: string,
  assets: AssetsDeNivel,
  ubicacion: UbicacionDeAssets,
): string | undefined {
  if (!Object.hasOwn(assets, clave)) return undefined;
  const ubicado = assets[clave]!; // `hasOwn` acaba de comprobar que existe

  let archivo: string;
  if (ubicado.asset.tipo === 'animacion') {
    archivo = ubicado.asset.cuadros[0]!; // el manifiesto garantiza al menos un cuadro
  } else {
    archivo = ubicado.asset.archivo;
  }
  return direccionDeArchivoDeAssets(ubicado.carpeta, archivo, ubicacion);
}

/**
 * Las direcciones de los cuadros de una imagen o animación, en el orden en que se muestran, con su ritmo.
 * Devuelve `undefined` si la clave no está en los assets del nivel o es un sonido o un video.
 */
export function buscarCuadrosDeAsset(
  clave: string,
  assets: AssetsDeNivel,
  ubicacion: UbicacionDeAssets,
): CuadrosDeAsset | undefined {
  if (!Object.hasOwn(assets, clave)) return undefined;
  const ubicado = assets[clave]!; // `hasOwn` acaba de comprobar que existe
  const asset = ubicado.asset;

  switch (asset.tipo) {
    case 'imagen':
      return { urls: [direccionDeArchivoDeAssets(ubicado.carpeta, asset.archivo, ubicacion)], cuadrosPorSegundo: 0 };
    case 'animacion': {
      const urls: string[] = [];
      for (const cuadro of asset.cuadros) {
        urls.push(direccionDeArchivoDeAssets(ubicado.carpeta, cuadro, ubicacion));
      }
      return { urls, cuadrosPorSegundo: asset.cuadrosPorSegundo };
    }
    case 'audio':
    case 'video':
      return undefined;
  }
}
