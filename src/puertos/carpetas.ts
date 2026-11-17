// El puerto por el que la aplicación recorre y escribe una carpeta de archivos.
// Lo usa el generador del manifiesto de assets, que solo corre en la línea de comandos.

export interface Carpetas {
  /**
   * Las rutas de todos los archivos de la carpeta y de sus subcarpetas, relativas a ella y separadas con `/`.
   * Ejemplo: `['assets.json', 'img/spr_mama.svg', 'voz/vo_hola.mp3']`.
   * Rechaza con `ErrorDeEscenario` si la carpeta no existe.
   */
  listarArchivos(carpeta: string): Promise<string[]>;

  /** El contenido de un archivo de la carpeta. `ruta` es relativa a la carpeta. */
  leerArchivo(carpeta: string, ruta: string): Promise<Uint8Array>;

  /** Crea o reemplaza un archivo de texto dentro de la carpeta. */
  escribirTexto(carpeta: string, ruta: string, texto: string): Promise<void>;
}
