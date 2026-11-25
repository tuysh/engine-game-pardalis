// Arma el manifiesto de una carpeta a partir de la lista de sus archivos de assets (docs/DISENO-3.0.md §8.1).
//
// Reglas:
// - La clave de un asset es el nombre de su archivo sin extensión: `img/spr_mama.svg` → `spr_mama`.
// - Las imágenes numeradas (`clave_1.svg`, `clave_2.svg`…) se agrupan solas en una animación llamada `clave`,
//   en orden numérico. Hacen falta al menos dos; una sola imagen numerada se queda como imagen normal.
// - Todos los cuadros de una animación deben medir lo mismo.
// - Los cuadros se numeran seguidos desde 1. Si no (`moneda_5`, `moneda_10`), casi seguro son imágenes
//   distintas cuyo nombre lleva un número: se agrupan igual, pero con una advertencia que lo dice.
// - Dos archivos no pueden dar la misma clave.
// - `assets.config.json` puede cambiar la velocidad de una animación y el orden de sus cuadros
//   (secuencia-de-cuadros.ts).

import { CUADROS_POR_SEGUNDO_POR_DEFECTO } from './manifiesto.ts';
import type { Asset, ConfiguracionDeAssets, Manifiesto, Medidas } from './manifiesto.ts';
import { nombreSinExtensionDe } from './ruta-de-asset.ts';
import { ordenarCuadros } from './secuencia-de-cuadros.ts';

/** Un archivo de la carpeta que ya se reconoció como asset. `ruta` es relativa a la carpeta. */
export type ArchivoDeAsset =
  | { readonly tipo: 'imagen'; readonly ruta: string; readonly medidas: Medidas }
  | { readonly tipo: 'audio'; readonly ruta: string }
  | { readonly tipo: 'video'; readonly ruta: string };

export interface ManifiestoArmado {
  readonly manifiesto: Manifiesto;
  readonly errores: readonly string[];
  readonly advertencias: readonly string[];
}

/** Un cuadro de una posible animación: una imagen cuyo nombre termina en `_<número>`. */
interface Cuadro {
  readonly numero: number;
  readonly ruta: string;
  readonly medidas: Medidas;
}

/** Lo que se va llenando mientras se arma el manifiesto. */
interface Armado {
  readonly manifiesto: Record<string, Asset>;
  /** De qué archivo salió cada clave, para explicar una clave repetida. */
  readonly origenDeCadaClave: Map<string, string>;
  readonly errores: string[];
  readonly advertencias: string[];
}

// Un nombre que termina en guion bajo y un número. En "tommy_viendo_tele_12" captura "tommy_viendo_tele" y "12".
const NOMBRE_NUMERADO = /^(.+)_(\d+)$/;

const CUADROS_MINIMOS_DE_UNA_ANIMACION = 2;

/**
 * `configuracion` es lo que pide `assets.config.json`: la velocidad y el orden de los cuadros de las animaciones
 * que no usan los de siempre.
 */
export function armarManifiesto(
  archivos: readonly ArchivoDeAsset[],
  configuracion: ConfiguracionDeAssets,
): ManifiestoArmado {
  const armado: Armado = { manifiesto: {}, origenDeCadaClave: new Map(), errores: [], advertencias: [] };
  const archivosEnOrden = [...archivos].sort((uno, otro) => compararTextos(uno.ruta, otro.ruta));
  const animaciones = agruparCuadros(archivosEnOrden);

  for (const archivo of archivosEnOrden) {
    const clave = nombreSinExtensionDe(archivo.ruta);
    switch (archivo.tipo) {
      case 'audio':
      case 'video':
        registrar(clave, { tipo: archivo.tipo, archivo: archivo.ruta }, archivo.ruta, armado);
        break;
      case 'imagen':
        if (esCuadroDeUnaAnimacion(clave, animaciones)) break; // se registra abajo, con su animación
        registrar(clave, { tipo: 'imagen', archivo: archivo.ruta, ...archivo.medidas }, archivo.ruta, armado);
        break;
    }
  }

  for (const [clave, cuadros] of animaciones) {
    registrarAnimacion(clave, cuadros, configuracion, armado);
  }
  avisarAjustesSinAnimacion(configuracion, animaciones, armado);

  return { manifiesto: armado.manifiesto, errores: armado.errores, advertencias: armado.advertencias };
}

/** Junta las imágenes numeradas por su nombre sin número y deja solo los grupos que forman una animación. */
function agruparCuadros(archivos: readonly ArchivoDeAsset[]): Map<string, Cuadro[]> {
  const grupos = new Map<string, Cuadro[]>();

  for (const archivo of archivos) {
    if (archivo.tipo !== 'imagen') continue;
    const partes = NOMBRE_NUMERADO.exec(nombreSinExtensionDe(archivo.ruta));
    if (partes === null) continue;

    const clave = partes[1]!; // los grupos 1 y 2 siempre existen cuando la expresión coincide
    const numero = Number(partes[2]);
    let cuadros = grupos.get(clave);
    if (cuadros === undefined) {
      cuadros = [];
      grupos.set(clave, cuadros);
    }
    cuadros.push({ numero, ruta: archivo.ruta, medidas: archivo.medidas });
  }

  for (const [clave, cuadros] of grupos) {
    if (cuadros.length < CUADROS_MINIMOS_DE_UNA_ANIMACION) {
      grupos.delete(clave);
    }
  }
  return grupos;
}

function esCuadroDeUnaAnimacion(nombre: string, animaciones: ReadonlyMap<string, Cuadro[]>): boolean {
  const partes = NOMBRE_NUMERADO.exec(nombre);
  if (partes === null) return false;
  return animaciones.has(partes[1]!); // el grupo 1 siempre existe cuando la expresión coincide
}

function registrarAnimacion(
  clave: string,
  cuadros: readonly Cuadro[],
  configuracion: ConfiguracionDeAssets,
  armado: Armado,
): void {
  const cuadrosPorSegundo = configuracion.cuadrosPorSegundo;
  const enOrden = [...cuadros].sort((uno, otro) => uno.numero - otro.numero);
  const primero = enOrden[0]!; // una animación tiene al menos dos cuadros

  for (const cuadro of enOrden) {
    const mideLoMismo =
      cuadro.medidas.anchoEnPixeles === primero.medidas.anchoEnPixeles &&
      cuadro.medidas.altoEnPixeles === primero.medidas.altoEnPixeles;
    if (!mideLoMismo) {
      armado.errores.push(
        `animación "${clave}": ${cuadro.ruta} mide ${describirMedidas(cuadro.medidas)} y ${primero.ruta} mide ` +
          `${describirMedidas(primero.medidas)}; todos los cuadros deben tener el mismo tamaño (viewBox)`,
      );
    }
  }

  avisarNumeracionQueNoParecenCuadros(clave, enOrden, armado);

  let velocidad = CUADROS_POR_SEGUNDO_POR_DEFECTO;
  if (Object.hasOwn(cuadrosPorSegundo, clave)) {
    velocidad = cuadrosPorSegundo[clave]!; // `hasOwn` acaba de comprobar que existe
  }

  let secuencia: readonly number[] | undefined;
  if (Object.hasOwn(configuracion.secuencias, clave)) {
    secuencia = configuracion.secuencias[clave];
  }
  const enSecuencia = ordenarCuadros(clave, enOrden, secuencia);
  armado.errores.push(...enSecuencia.errores);

  const asset: Asset = {
    tipo: 'animacion',
    cuadros: enSecuencia.rutas,
    cuadrosPorSegundo: velocidad,
    ...primero.medidas,
  };
  registrar(clave, asset, `los cuadros ${primero.ruta}…`, armado);
}

/**
 * Los cuadros de una animación se numeran 1, 2, 3… Una numeración con saltos o que no empieza en 1
 * (`moneda_1`, `moneda_5`, `moneda_10`) suele ser de imágenes distintas que nadie quiso animar.
 */
function avisarNumeracionQueNoParecenCuadros(clave: string, cuadrosEnOrden: readonly Cuadro[], armado: Armado): void {
  let vanSeguidosDesdeUno = true;
  for (let i = 0; i < cuadrosEnOrden.length; i++) {
    const numeroEsperado = i + 1;
    if (cuadrosEnOrden[i]!.numero !== numeroEsperado) {
      vanSeguidosDesdeUno = false; // `i` es menor que el largo de la lista
    }
  }
  if (vanSeguidosDesdeUno) return;

  const nombres: string[] = [];
  for (const cuadro of cuadrosEnOrden) {
    nombres.push(`"${nombreSinExtensionDe(cuadro.ruta)}"`);
  }
  armado.advertencias.push(
    `${nombres.join(', ')} se agruparon en la animación "${clave}", pero sus números no van seguidos desde 1; ` +
      'si son imágenes distintas, cámbiales el nombre para que no termine en _número',
  );
}

/** Guarda un asset en el manifiesto, o anota un error si su clave ya salió de otro archivo. */
function registrar(clave: string, asset: Asset, origen: string, armado: Armado): void {
  // Guardar la clave "__proto__" cambiaría el prototipo del objeto en vez de agregar un asset.
  if (clave === '__proto__') {
    armado.errores.push(`${origen}: "__proto__" no se puede usar como nombre de archivo; cámbialo`);
    return;
  }

  const origenAnterior = armado.origenDeCadaClave.get(clave);
  if (origenAnterior !== undefined) {
    armado.errores.push(
      `la clave "${clave}" sale de dos archivos: ${origenAnterior} y ${origen}; cambia el nombre de uno`,
    );
    return;
  }
  armado.origenDeCadaClave.set(clave, origen);
  armado.manifiesto[clave] = asset;
}

/** Un ajuste de `assets.config.json` que nombra algo que no es una animación casi siempre es un error de dedo. */
function avisarAjustesSinAnimacion(
  configuracion: ConfiguracionDeAssets,
  animaciones: ReadonlyMap<string, Cuadro[]>,
  armado: Armado,
): void {
  for (const clave of Object.keys(configuracion.cuadrosPorSegundo)) {
    if (!animaciones.has(clave)) {
      armado.advertencias.push(`assets.config.json: "fps" nombra "${clave}", que no es una animación de esta carpeta`);
    }
  }
  for (const clave of Object.keys(configuracion.secuencias)) {
    if (!animaciones.has(clave)) {
      armado.advertencias.push(
        `assets.config.json: "secuencia" nombra "${clave}", que no es una animación de esta carpeta`,
      );
    }
  }
}

/**
 * Orden alfabético simple, letra por letra. Se usa en vez de `localeCompare` para que el manifiesto
 * salga en el mismo orden en cualquier computadora, sin importar su idioma.
 */
function compararTextos(uno: string, otro: string): number {
  if (uno < otro) return -1;
  if (uno > otro) return 1;
  return 0;
}

function describirMedidas(medidas: Medidas): string {
  return `${medidas.anchoEnPixeles}×${medidas.altoEnPixeles}`;
}
