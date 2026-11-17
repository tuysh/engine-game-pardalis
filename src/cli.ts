#!/usr/bin/env node
// Línea de comandos del motor: valida niveles y genera manifiestos de assets, sin navegador.
// Corre en Bun y en Node. Uso: `escenario-engine ayuda`.
//
// Estado: los comandos todavía no hacen su trabajo. `validar` llega con la fase 2 del diseño
// y `assets` con la fase 3 (docs/DISENO-3.0.md §13). Por ahora avisan y terminan con error,
// para que ningún script de CI crea que un nivel quedó validado.

import { interpretarComando, TEXTO_DE_AYUDA } from './aplicacion/interpretar-comando.ts';

const CODIGO_DE_EXITO = 0;
const CODIGO_DE_ERROR = 1;

function ejecutar(argumentos: readonly string[]): number {
  const comando = interpretarComando(argumentos);

  switch (comando.tipo) {
    case 'ayuda':
      console.log(TEXTO_DE_AYUDA);
      return CODIGO_DE_EXITO;

    case 'validar':
      console.error(`[escenario-engine] "validar" todavía no está disponible (no se revisó ${comando.rutaDelNivel})`);
      return CODIGO_DE_ERROR;

    case 'assets':
      console.error(`[escenario-engine] "assets" todavía no está disponible (no se generó nada en ${comando.carpeta})`);
      return CODIGO_DE_ERROR;

    case 'invalido':
      console.error(`[escenario-engine] ${comando.mensaje}`);
      console.error(TEXTO_DE_AYUDA);
      return CODIGO_DE_ERROR;
  }
}

// Los dos primeros argumentos son el ejecutable y la ruta de este archivo.
const argumentosDelUsuario = process.argv.slice(2);
process.exitCode = ejecutar(argumentosDelUsuario);
