// El puerto por el que la aplicación trae archivos: de la red en el navegador,
// del disco en la línea de comandos, de la memoria en las pruebas.
//
// Estado: por ahora solo trae JSON. La carga de imágenes, sonidos y videos se agrega con los assets.

export interface Cargador {
  /**
   * Trae un archivo JSON y lo entrega tal cual, sin revisar: quien lo recibe debe tratarlo como no confiable.
   * Rechaza con `ErrorDeEscenario` si el archivo no existe o no es JSON válido.
   */
  cargarJson(direccion: string): Promise<unknown>;

  /**
   * Dirección de un archivo nombrado con una ruta relativa a otro archivo.
   * Ejemplo: con `'/niveles/casa/nivel.json'` y `'contenido.json'` da `'/niveles/casa/contenido.json'`.
   */
  resolverJuntoA(direccionBase: string, rutaRelativa: string): string;
}
