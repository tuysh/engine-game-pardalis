// Entrada pública `@pardalis/escenario-engine/validar`: validar niveles sin navegador, por ejemplo en CI.
// Este archivo no debe importar nada de `adaptadores/three/` ni `adaptadores/dom/`.
//
// Uso:
//   import { validarNivel } from '@pardalis/escenario-engine/validar';
//   const resultado = await validarNivel('niveles/barrio/nivel.json', { minijuegos: ['Tortilleria'] });
//   if (resultado.errores.length > 0) { ... }
//
// Estado: todavía no revisa el mapa ni los assets (docs/DISENO-3.0.md §13, fases 3 y 4).

import { CargadorDeArchivos } from './adaptadores/archivos/cargador-de-archivos.ts';
import { LectorDeNivelesDeJson } from './adaptadores/json/lector-de-niveles-de-json.ts';
// Se importa con otro nombre porque la función pública de este archivo también se llama `validarNivel`.
import { validarNivel as validarNivelConPuertos } from './aplicacion/validar-nivel.ts';
import type { ResultadoDeValidacion } from './aplicacion/validar-nivel.ts';

export { ErrorDeEscenario } from './dominio/error-de-escenario.ts';
export type { ResultadoDeValidacion } from './aplicacion/validar-nivel.ts';
export type { Nivel } from './dominio/nivel.ts';

export interface OpcionesDeValidacion {
  /**
   * Nombres de los minijuegos que el host registra en `crearEscenario({ minijuegos })`.
   * Si se omite, los pasos `juego` no se revisan.
   */
  readonly minijuegos?: readonly string[];
}

/**
 * Valida un nivel leyendo sus archivos del disco. Nunca rechaza por un nivel mal escrito:
 * los problemas llegan en `errores` y `advertencias`, cada uno con la ruta de donde está.
 */
export async function validarNivel(
  rutaDelNivel: string,
  opciones: OpcionesDeValidacion = {},
): Promise<ResultadoDeValidacion> {
  const puertos = { cargador: new CargadorDeArchivos(), lector: new LectorDeNivelesDeJson() };
  return validarNivelConPuertos({ direccionDelNivel: rutaDelNivel, minijuegos: opciones.minijuegos }, puertos);
}
