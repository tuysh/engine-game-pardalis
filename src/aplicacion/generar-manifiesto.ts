// Caso de uso: generar el `assets.json` de una carpeta de assets (docs/DISENO-3.0.md §8.1).
// Es lo que hace `escenario-engine assets <carpeta>`.
//
// Pasos:
//   1. lista los archivos de la carpeta y sus subcarpetas
//   2. lee `assets.config.json`, si existe
//   3. reconoce cada asset por su extensión y mide las imágenes
//   4. arma el manifiesto (claves, animaciones) y lo escribe
//
// Si hay algún error, el archivo NO se escribe: un manifiesto a medias sería peor que ninguno.

import { armarManifiesto } from '../dominio/armar-manifiesto.ts';
import type { ArchivoDeAsset } from '../dominio/armar-manifiesto.ts';
import { crearDiagnostico } from '../dominio/diagnostico.ts';
import type { Diagnostico } from '../dominio/diagnostico.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { NOMBRE_DE_LA_CONFIGURACION_DE_ASSETS, NOMBRE_DEL_MANIFIESTO } from '../dominio/manifiesto.ts';
import type { ConfiguracionDeAssets, Manifiesto } from '../dominio/manifiesto.ts';
import { medirImagen } from '../dominio/medir-imagen.ts';
import { enlacesExternosDeSvg } from '../dominio/medir-svg.ts';
import { extensionDe, tipoDeArchivoDeAsset } from '../dominio/ruta-de-asset.ts';
import type { Carpetas } from '../puertos/carpetas.ts';
import type { EscritorDeManifiestos } from '../puertos/escritor-de-manifiestos.ts';

export interface PuertosParaGenerar {
  readonly carpetas: Carpetas;
  readonly escritor: EscritorDeManifiestos;
}

/** Una animación que el generador formó al agrupar imágenes numeradas. */
export interface AnimacionGenerada {
  readonly clave: string;
  readonly cantidadDeCuadros: number;
  readonly cuadrosPorSegundo: number;
}

export interface ResultadoDeGenerar {
  readonly errores: readonly string[];
  readonly advertencias: readonly string[];
  /** Cuántos assets quedaron en el manifiesto. Es 0 si hubo errores, porque entonces no se escribe. */
  readonly cantidadDeAssets: number;
  /**
   * Las animaciones que quedaron en el manifiesto, en orden alfabético. Se informan una por una para que
   * una animación que nadie quiso (imágenes distintas con nombre numerado) se note al momento.
   * Vacía si hubo errores.
   */
  readonly animaciones: readonly AnimacionGenerada[];
}

/** Lo que `generar` escribió. */
interface ManifiestoEscrito {
  readonly cantidadDeAssets: number;
  readonly animaciones: readonly AnimacionGenerada[];
}

const NADA_ESCRITO: ManifiestoEscrito = { cantidadDeAssets: 0, animaciones: [] };

export async function generarManifiesto(carpeta: string, puertos: PuertosParaGenerar): Promise<ResultadoDeGenerar> {
  const diagnostico = crearDiagnostico();
  let escrito = NADA_ESCRITO;

  try {
    escrito = await generar(carpeta, puertos, diagnostico);
  } catch (error) {
    // Una carpeta o un archivo que no se pudo leer se reporta con los demás problemas.
    // Cualquier otro error es una falla del motor y no se esconde.
    if (!(error instanceof ErrorDeEscenario)) throw error;
    diagnostico.errores.push(...error.problemas);
  }

  return {
    errores: diagnostico.errores,
    advertencias: diagnostico.advertencias,
    cantidadDeAssets: escrito.cantidadDeAssets,
    animaciones: escrito.animaciones,
  };
}

/** Escribe el manifiesto y dice qué quedó en él. Si se anotaron errores, no escribe nada. */
async function generar(
  carpeta: string,
  puertos: PuertosParaGenerar,
  diagnostico: Diagnostico,
): Promise<ManifiestoEscrito> {
  const rutas = await puertos.carpetas.listarArchivos(carpeta);

  const configuracion = await leerConfiguracion(carpeta, rutas, puertos, diagnostico);
  const archivos = await reconocerAssets(carpeta, rutas, puertos.carpetas, diagnostico);

  const armado = armarManifiesto(archivos, configuracion.cuadrosPorSegundo);
  diagnostico.errores.push(...armado.errores);
  diagnostico.advertencias.push(...armado.advertencias);
  if (diagnostico.errores.length > 0) return NADA_ESCRITO;

  const texto = puertos.escritor.redactarManifiesto(armado.manifiesto);
  await puertos.carpetas.escribirTexto(carpeta, NOMBRE_DEL_MANIFIESTO, texto);
  return {
    cantidadDeAssets: Object.keys(armado.manifiesto).length,
    animaciones: listarAnimaciones(armado.manifiesto),
  };
}

function listarAnimaciones(manifiesto: Manifiesto): AnimacionGenerada[] {
  const animaciones: AnimacionGenerada[] = [];
  for (const clave of Object.keys(manifiesto).sort()) {
    const asset = manifiesto[clave]!; // `clave` viene de `Object.keys`, así que existe
    if (asset.tipo !== 'animacion') continue;
    animaciones.push({ clave, cantidadDeCuadros: asset.cuadros.length, cuadrosPorSegundo: asset.cuadrosPorSegundo });
  }
  return animaciones;
}

/** Lee `assets.config.json`. Si no existe, o si está mal (y entonces anota el error), no hay ajustes. */
async function leerConfiguracion(
  carpeta: string,
  rutas: readonly string[],
  puertos: PuertosParaGenerar,
  diagnostico: Diagnostico,
): Promise<ConfiguracionDeAssets> {
  const sinAjustes: ConfiguracionDeAssets = { cuadrosPorSegundo: {} };
  if (!rutas.includes(NOMBRE_DE_LA_CONFIGURACION_DE_ASSETS)) return sinAjustes;

  const bytes = await puertos.carpetas.leerArchivo(carpeta, NOMBRE_DE_LA_CONFIGURACION_DE_ASSETS);
  let json: unknown;
  try {
    json = JSON.parse(new TextDecoder().decode(bytes));
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    diagnostico.errores.push(`${NOMBRE_DE_LA_CONFIGURACION_DE_ASSETS} no es JSON válido: ${error.message}`);
    return sinAjustes;
  }

  const lectura = puertos.escritor.leerConfiguracion(json);
  if (lectura.tipo === 'invalido') {
    for (const error of lectura.errores) {
      diagnostico.errores.push(`${NOMBRE_DE_LA_CONFIGURACION_DE_ASSETS}: ${error}`);
    }
    return sinAjustes;
  }
  return lectura.valor;
}

/** Convierte la lista de rutas en la lista de assets. Los archivos que no son assets se ignoran. */
async function reconocerAssets(
  carpeta: string,
  rutas: readonly string[],
  carpetas: Carpetas,
  diagnostico: Diagnostico,
): Promise<ArchivoDeAsset[]> {
  const archivos: ArchivoDeAsset[] = [];

  for (const ruta of rutas) {
    const tipo = tipoDeArchivoDeAsset(ruta);
    if (tipo === undefined) continue;

    if (tipo !== 'imagen') {
      archivos.push({ tipo, ruta });
      continue;
    }

    const bytes = await carpetas.leerArchivo(carpeta, ruta);
    const medidas = medirImagen(ruta, bytes);
    if (medidas === undefined) {
      diagnostico.errores.push(explicarImagenSinMedidas(ruta));
      continue;
    }
    avisarEnlacesExternos(ruta, bytes, diagnostico);
    archivos.push({ tipo: 'imagen', ruta, medidas });
  }
  return archivos;
}

function explicarImagenSinMedidas(ruta: string): string {
  if (extensionDe(ruta) === '.svg') {
    return `${ruta}: el SVG no tiene viewBox (ni width y height); agrégale un viewBox para saber su tamaño`;
  }
  return `${ruta}: no se pudo leer el tamaño de la imagen; revisa que el archivo no esté dañado`;
}

function avisarEnlacesExternos(ruta: string, bytes: Uint8Array, diagnostico: Diagnostico): void {
  if (extensionDe(ruta) !== '.svg') return;

  const enlaces = enlacesExternosDeSvg(new TextDecoder().decode(bytes));
  if (enlaces.length > 0) {
    diagnostico.advertencias.push(
      `${ruta}: el SVG enlaza archivos externos (${enlaces.join(', ')}); al usarse como textura no se cargan`,
    );
  }
}
