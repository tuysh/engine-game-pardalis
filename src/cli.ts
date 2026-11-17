#!/usr/bin/env node
// Línea de comandos del motor: valida niveles y genera manifiestos de assets, sin navegador.
// Corre en Bun y en Node. Uso: `escenario-engine ayuda`.
//
import { CarpetasDeDisco } from './adaptadores/archivos/carpetas-de-disco.ts';
import { EscritorDeManifiestosDeJson } from './adaptadores/json/escritor-de-manifiestos-de-json.ts';
import { generarManifiesto } from './aplicacion/generar-manifiesto.ts';
import { interpretarComando, TEXTO_DE_AYUDA } from './aplicacion/interpretar-comando.ts';
import { redactarInformeDeAssets } from './aplicacion/redactar-informe-de-assets.ts';
import { redactarInformeDeValidacion } from './aplicacion/redactar-informe-de-validacion.ts';
import { validarNivel } from './validar.ts';
import type { OpcionesDeValidacion } from './validar.ts';

const CODIGO_DE_EXITO = 0;
const CODIGO_DE_ERROR = 1;

async function ejecutar(argumentos: readonly string[]): Promise<number> {
  const comando = interpretarComando(argumentos);

  switch (comando.tipo) {
    case 'ayuda':
      console.log(TEXTO_DE_AYUDA);
      return CODIGO_DE_EXITO;

    case 'validar':
      return validar(comando.rutaDelNivel, { minijuegos: comando.minijuegos, cinematicas: comando.cinematicas });

    case 'assets':
      return generarAssets(comando.carpeta);

    case 'invalido':
      console.error(`[escenario-engine] ${comando.mensaje}`);
      console.error(TEXTO_DE_AYUDA);
      return CODIGO_DE_ERROR;
  }
}

async function validar(rutaDelNivel: string, registros: OpcionesDeValidacion): Promise<number> {
  const resultado = await validarNivel(rutaDelNivel, registros);

  for (const linea of redactarInformeDeValidacion(rutaDelNivel, resultado)) {
    console.log(linea);
  }

  if (resultado.errores.length > 0) return CODIGO_DE_ERROR;
  return CODIGO_DE_EXITO;
}

async function generarAssets(carpeta: string): Promise<number> {
  const puertos = { carpetas: new CarpetasDeDisco(), escritor: new EscritorDeManifiestosDeJson() };
  const resultado = await generarManifiesto(carpeta, puertos);

  for (const linea of redactarInformeDeAssets(carpeta, resultado)) {
    console.log(linea);
  }

  if (resultado.errores.length > 0) return CODIGO_DE_ERROR;
  return CODIGO_DE_EXITO;
}

// Los dos primeros argumentos son el ejecutable y la ruta de este archivo.
const argumentosDelUsuario = process.argv.slice(2);
process.exitCode = await ejecutar(argumentosDelUsuario);
