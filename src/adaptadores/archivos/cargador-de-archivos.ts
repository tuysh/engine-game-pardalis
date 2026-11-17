// Cargador que lee archivos del disco. Lo usa la línea de comandos (corre en Bun y en Node).

import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { ErrorDeEscenario } from '../../dominio/error-de-escenario.ts';
import { esObjetoPlano } from '../../dominio/es-objeto-plano.ts';
import type { Cargador } from '../../puertos/cargador.ts';

/** Código con el que el sistema avisa que un archivo no existe. */
const CODIGO_DE_ARCHIVO_INEXISTENTE = 'ENOENT';

export class CargadorDeArchivos implements Cargador {
  async cargarJson(direccion: string): Promise<unknown> {
    const texto = await leerTexto(direccion);
    try {
      const json: unknown = JSON.parse(texto);
      return json;
    } catch (error) {
      throw new ErrorDeEscenario([`${direccion} no es JSON válido: ${describirError(error)}`]);
    }
  }

  resolverJuntoA(direccionBase: string, rutaRelativa: string): string {
    return resolve(dirname(direccionBase), rutaRelativa);
  }
}

async function leerTexto(direccion: string): Promise<string> {
  try {
    return await readFile(direccion, 'utf8');
  } catch (error) {
    const noExiste = esObjetoPlano(error) && error.code === CODIGO_DE_ARCHIVO_INEXISTENTE;
    if (noExiste) {
      throw new ErrorDeEscenario([`no existe el archivo ${direccion}`]);
    }
    throw new ErrorDeEscenario([`no se pudo leer ${direccion}: ${describirError(error)}`]);
  }
}

function describirError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
