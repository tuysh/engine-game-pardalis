#!/usr/bin/env node
// Línea de comandos del motor: valida niveles y genera manifiestos de assets, sin navegador.
// Corre en Bun y en Node. Uso: `escenario-engine ayuda`.
//
// Estado:
// - `validar` revisa nivel.json y el contenido. Todavía NO revisa el mapa ni los assets, y lo dice al terminar.
// - `assets` todavía no hace su trabajo: avisa y termina con error. Llega con la fase 3 (docs/DISENO-3.0.md §13).

import { interpretarComando, TEXTO_DE_AYUDA } from './aplicacion/interpretar-comando.ts';
import { redactarInformeDeValidacion } from './aplicacion/redactar-informe-de-validacion.ts';
import { validarNivel } from './validar.ts';

const CODIGO_DE_EXITO = 0;
const CODIGO_DE_ERROR = 1;

async function ejecutar(argumentos: readonly string[]): Promise<number> {
  const comando = interpretarComando(argumentos);

  switch (comando.tipo) {
    case 'ayuda':
      console.log(TEXTO_DE_AYUDA);
      return CODIGO_DE_EXITO;

    case 'validar':
      return validar(comando.rutaDelNivel, comando.minijuegos);

    case 'assets':
      console.error(`[escenario-engine] "assets" todavía no está disponible (no se generó nada en ${comando.carpeta})`);
      return CODIGO_DE_ERROR;

    case 'invalido':
      console.error(`[escenario-engine] ${comando.mensaje}`);
      console.error(TEXTO_DE_AYUDA);
      return CODIGO_DE_ERROR;
  }
}

async function validar(rutaDelNivel: string, minijuegos: readonly string[] | undefined): Promise<number> {
  const resultado = await validarNivel(rutaDelNivel, { minijuegos });

  for (const linea of redactarInformeDeValidacion(rutaDelNivel, resultado)) {
    console.log(linea);
  }
  console.log('Nota: esta versión todavía no revisa el mapa ni los assets del nivel.');

  if (resultado.errores.length > 0) return CODIGO_DE_ERROR;
  return CODIGO_DE_EXITO;
}

// Los dos primeros argumentos son el ejecutable y la ruta de este archivo.
const argumentosDelUsuario = process.argv.slice(2);
process.exitCode = await ejecutar(argumentosDelUsuario);
