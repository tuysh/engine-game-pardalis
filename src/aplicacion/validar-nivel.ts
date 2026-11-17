// Caso de uso: validar un nivel antes de jugarlo. Lo usan la línea de comandos y, más adelante, la carga del juego.
//
// La validación va por fases y se detiene en la primera que encuentra errores:
//   1. nivel.json existe y tiene la forma esperada
//   2. el contenido existe y tiene la forma esperada (tipos, campos obligatorios, claves conocidas)
//   3. enlaces: todo lo que el contenido nombra existe (secuencias, hablantes, variables, minijuegos)
//   4. assets: cada carpeta de assets tiene su manifiesto, y existe cada imagen y voz que el contenido nombra
//
// Estado: todavía no se revisa el mapa; esa fase se agrega con el lector de Tiled (docs/DISENO-3.0.md §13, fase 4).

import { crearDiagnostico } from '../dominio/diagnostico.ts';
import type { Diagnostico } from '../dominio/diagnostico.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import type { Nivel } from '../dominio/nivel.ts';
import { revisarAssets } from '../dominio/revisar-assets.ts';
import { revisarEnlaces } from '../dominio/revisar-enlaces.ts';
import type { Cargador } from '../puertos/cargador.ts';
import type { LectorDeNiveles } from '../puertos/lector-de-niveles.ts';
import { cargarAssetsDeNivel } from './cargar-assets-de-nivel.ts';

export interface PedidoDeValidacion {
  /** Dirección del `nivel.json`: una URL en el navegador, una ruta en la línea de comandos. */
  readonly direccionDelNivel: string;
  /** Nombres de los minijuegos que registró el host. `undefined` = no se sabe, así que no se revisan. */
  readonly minijuegos?: readonly string[];
}

export interface PuertosParaValidar {
  readonly cargador: Cargador;
  readonly lector: LectorDeNiveles;
}

export interface ResultadoDeValidacion {
  readonly errores: readonly string[];
  readonly advertencias: readonly string[];
  /** El nivel listo para usarse. Solo existe si no hubo errores. */
  readonly nivel?: Nivel;
}

export async function validarNivel(
  pedido: PedidoDeValidacion,
  puertos: PuertosParaValidar,
): Promise<ResultadoDeValidacion> {
  const diagnostico = crearDiagnostico();
  let nivel: Nivel | undefined;

  try {
    nivel = await leerYRevisar(pedido, puertos, diagnostico);
  } catch (error) {
    // Un archivo que no se pudo traer es un problema del nivel y se reporta con los demás.
    // Cualquier otro error es una falla del motor y no se esconde.
    if (!(error instanceof ErrorDeEscenario)) throw error;
    diagnostico.errores.push(...error.problemas);
  }

  if (diagnostico.errores.length > 0) {
    return { errores: diagnostico.errores, advertencias: diagnostico.advertencias };
  }
  return { errores: [], advertencias: diagnostico.advertencias, nivel };
}

/** Devuelve el nivel, o `undefined` si una fase anotó errores y no tiene caso seguir. */
async function leerYRevisar(
  pedido: PedidoDeValidacion,
  puertos: PuertosParaValidar,
  diagnostico: Diagnostico,
): Promise<Nivel | undefined> {
  const direccionDelNivel = pedido.direccionDelNivel;

  const jsonDelNivel = await puertos.cargador.cargarJson(direccionDelNivel);
  const lecturaDelNivel = puertos.lector.leerDescripcionDeNivel(jsonDelNivel);
  if (lecturaDelNivel.tipo === 'invalido') {
    for (const error of lecturaDelNivel.errores) {
      diagnostico.errores.push(`${direccionDelNivel}: ${error}`);
    }
    return undefined;
  }
  const descripcion = lecturaDelNivel.valor;

  const direccionDelContenido = puertos.cargador.resolverJuntoA(direccionDelNivel, descripcion.contenido);
  const jsonDelContenido = await puertos.cargador.cargarJson(direccionDelContenido);
  const lecturaDelContenido = puertos.lector.leerContenido(jsonDelContenido);
  if (lecturaDelContenido.tipo === 'invalido') {
    diagnostico.errores.push(...lecturaDelContenido.errores);
    return undefined;
  }
  const contenido = lecturaDelContenido.valor;

  revisarEnlaces(contenido, pedido.minijuegos, diagnostico);
  if (diagnostico.errores.length > 0) return undefined;

  const pedidoDeAssets = { direccionDelNivel, descripcion, cargador: puertos.cargador, lector: puertos.lector };
  const assets = await cargarAssetsDeNivel(pedidoDeAssets, diagnostico);
  if (diagnostico.errores.length > 0) return undefined;

  revisarAssets(contenido, assets, diagnostico);
  return { descripcion, contenido, assets };
}
