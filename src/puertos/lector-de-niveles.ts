// El puerto que convierte los archivos de un nivel, tal como llegan de afuera,
// en tipos del dominio ya revisados. Si el archivo no tiene la forma esperada, dice qué está mal y dónde.

import type { Contenido } from '../dominio/contenido.ts';
import type { DescripcionDeNivel } from '../dominio/descripcion-de-nivel.ts';
import type { Manifiesto } from '../dominio/manifiesto.ts';

/** Resultado de leer un archivo: o el valor ya revisado, o la lista de lo que está mal. */
export type Lectura<Valor> =
  | { readonly tipo: 'leido'; readonly valor: Valor }
  | { readonly tipo: 'invalido'; readonly errores: readonly string[] };

export interface LectorDeNiveles {
  /** Lee el JSON de un `nivel.json`. */
  leerDescripcionDeNivel(json: unknown): Lectura<DescripcionDeNivel>;
  /** Lee el JSON de un archivo de contenido. Cada error lleva la ruta del problema dentro del archivo. */
  leerContenido(json: unknown): Lectura<Contenido>;
  /** Lee el JSON de un manifiesto de assets (`assets.json`). */
  leerManifiesto(json: unknown): Lectura<Manifiesto>;
}
