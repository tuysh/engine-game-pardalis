// Reconoce los errores que da el sistema al leer archivos, para convertirlos en mensajes en español.

import { esObjetoPlano } from '../../dominio/es-objeto-plano.ts';

/** Código con el que el sistema avisa que un archivo o carpeta no existe. */
const CODIGO_DE_INEXISTENTE = 'ENOENT';

/** Dice si el error es el que da el sistema cuando el archivo o la carpeta no existe. */
export function esErrorDeInexistente(error: unknown): boolean {
  return esObjetoPlano(error) && error.code === CODIGO_DE_INEXISTENTE;
}
