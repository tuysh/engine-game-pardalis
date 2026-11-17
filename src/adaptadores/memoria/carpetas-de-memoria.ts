// Carpetas falsas para las pruebas: los archivos viven en memoria.
//
// Uso:
//   const carpetas = new CarpetasDeMemoria({ 'niveles/casa': { 'img/spr_mama.svg': '<svg viewBox="0 0 1 1"/>' } });
//   ...
//   carpetas.textoEscrito('niveles/casa', 'assets.json')

import { ErrorDeEscenario } from '../../dominio/error-de-escenario.ts';
import type { Carpetas } from '../../puertos/carpetas.ts';

/** El contenido de un archivo falso: texto, o bytes para imágenes como PNG. */
export type ContenidoDeArchivo = string | Uint8Array;

/** Carpeta → ruta del archivo → contenido. */
export type ArchivosPorCarpeta = Readonly<Record<string, Readonly<Record<string, ContenidoDeArchivo>>>>;

export class CarpetasDeMemoria implements Carpetas {
  private readonly archivosPorCarpeta: ArchivosPorCarpeta;
  /** Lo que se escribió durante la prueba, con la clave `carpeta/ruta`. */
  private readonly textosEscritos = new Map<string, string>();

  constructor(archivosPorCarpeta: ArchivosPorCarpeta) {
    this.archivosPorCarpeta = archivosPorCarpeta;
  }

  async listarArchivos(carpeta: string): Promise<string[]> {
    if (!Object.hasOwn(this.archivosPorCarpeta, carpeta)) {
      throw new ErrorDeEscenario([`no existe la carpeta ${carpeta}`]);
    }
    return Object.keys(this.archivosPorCarpeta[carpeta]!).sort(); // `hasOwn` acaba de comprobar que existe
  }

  async leerArchivo(carpeta: string, ruta: string): Promise<Uint8Array> {
    const archivos = this.archivosPorCarpeta[carpeta];
    if (archivos === undefined || !Object.hasOwn(archivos, ruta)) {
      throw new ErrorDeEscenario([`no se pudo leer ${carpeta}/${ruta}: no existe`]);
    }
    const contenido = archivos[ruta]!; // `hasOwn` acaba de comprobar que existe
    if (typeof contenido === 'string') {
      return new TextEncoder().encode(contenido);
    }
    return contenido;
  }

  async escribirTexto(carpeta: string, ruta: string, texto: string): Promise<void> {
    this.textosEscritos.set(`${carpeta}/${ruta}`, texto);
  }

  /** Para comprobar en una prueba qué se escribió. `undefined` = no se escribió ese archivo. */
  textoEscrito(carpeta: string, ruta: string): string | undefined {
    return this.textosEscritos.get(`${carpeta}/${ruta}`);
  }
}
