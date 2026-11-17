// Calcula la dirección completa de un archivo de assets de un nivel: junto a su `nivel.json`,
// o bajo `raizDeAssets` si el host la dio (docs/DISENO-3.0.md §8.3).

import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { rutaDesdeLaRaizDeAssets } from '../dominio/ruta-desde-la-raiz-de-assets.ts';
import type { Cargador } from '../puertos/cargador.ts';

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
