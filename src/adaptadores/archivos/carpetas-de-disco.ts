// Recorre y escribe carpetas del disco. Lo usa el generador de manifiestos de la línea de comandos.

import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { ErrorDeEscenario } from '../../dominio/error-de-escenario.ts';
import type { Carpetas } from '../../puertos/carpetas.ts';
import { describirError, esErrorDeInexistente } from './errores-de-archivo.ts';

export class CarpetasDeDisco implements Carpetas {
  /** No incluye los archivos ocultos ni lo que hay dentro de carpetas ocultas (los que empiezan con punto). */
  async listarArchivos(carpeta: string): Promise<string[]> {
    const entradas = await leerEntradas(carpeta);

    const rutas: string[] = [];
    for (const entrada of entradas) {
      if (!entrada.isFile()) continue;
      const rutaCompleta = join(entrada.parentPath, entrada.name);
      // En Windows las rutas llegan con barra invertida; el motor siempre usa la barra normal.
      const rutaRelativa = relative(carpeta, rutaCompleta).split(sep).join('/');
      if (!estaOculta(rutaRelativa)) {
        rutas.push(rutaRelativa);
      }
    }
    return rutas.sort();
  }

  async leerArchivo(carpeta: string, ruta: string): Promise<Uint8Array> {
    const rutaCompleta = join(carpeta, ruta);
    try {
      return await readFile(rutaCompleta);
    } catch (error) {
      throw new ErrorDeEscenario([`no se pudo leer ${rutaCompleta}: ${describirError(error)}`]);
    }
  }

  async escribirTexto(carpeta: string, ruta: string, texto: string): Promise<void> {
    const rutaCompleta = join(carpeta, ruta);
    try {
      await writeFile(rutaCompleta, texto, 'utf8');
    } catch (error) {
      throw new ErrorDeEscenario([`no se pudo escribir ${rutaCompleta}: ${describirError(error)}`]);
    }
  }
}

async function leerEntradas(carpeta: string) {
  try {
    return await readdir(carpeta, { recursive: true, withFileTypes: true });
  } catch (error) {
    if (esErrorDeInexistente(error)) {
      throw new ErrorDeEscenario([`no existe la carpeta ${carpeta}`]);
    }
    throw new ErrorDeEscenario([`no se pudo abrir la carpeta ${carpeta}: ${describirError(error)}`]);
  }
}

/** Dice si el archivo, o alguna de las carpetas que lo contienen, empieza con punto (como `.git` o `.DS_Store`). */
function estaOculta(rutaRelativa: string): boolean {
  const partes = rutaRelativa.split('/');
  return partes.some((parte) => parte.startsWith('.'));
}
