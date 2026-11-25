// Decide en qué orden pasan los cuadros de una animación.
// Lo normal es del primero al último. Con una secuencia de `assets.config.json` pasan en el orden que ella
// dice, y un cuadro se puede repetir: así un personaje parpadea con dos dibujos en vez de seis archivos.
//
//   "secuencia": { "spr_pardi": [1, 1, 1, 1, 1, 2] }     cinco cuadros con los ojos abiertos y uno cerrados

/** Un archivo numerado de una animación: `spr_pardi_2.svg` es el número 2. */
export interface CuadroNumerado {
  readonly numero: number;
  readonly ruta: string;
}

export interface CuadrosEnSecuencia {
  /** Las rutas de los cuadros, en el orden en que pasan. */
  readonly rutas: readonly string[];
  /** Un mensaje por cada número de la secuencia que no es el de ningún archivo. */
  readonly errores: readonly string[];
}

/**
 * `cuadrosEnOrden` son los archivos de la animación, del número menor al mayor.
 * `secuencia` es la que pide la configuración para esa animación; `undefined` = pasan en su orden.
 */
export function ordenarCuadros(
  clave: string,
  cuadrosEnOrden: readonly CuadroNumerado[],
  secuencia: readonly number[] | undefined,
): CuadrosEnSecuencia {
  if (secuencia === undefined) {
    return { rutas: cuadrosEnOrden.map((cuadro) => cuadro.ruta), errores: [] };
  }

  const rutas: string[] = [];
  const errores: string[] = [];
  for (const numero of secuencia) {
    const cuadro = cuadrosEnOrden.find((candidato) => candidato.numero === numero);
    if (cuadro === undefined) {
      errores.push(
        `assets.config.json: "secuencia" de "${clave}" nombra el cuadro ${numero}, ` +
          `pero no hay un archivo "${clave}_${numero}"`,
      );
      continue;
    }
    rutas.push(cuadro.ruta);
  }
  return { rutas, errores };
}
