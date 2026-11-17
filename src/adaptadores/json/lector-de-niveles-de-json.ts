// Lee los archivos JSON de un nivel con Zod y los convierte en tipos del dominio.
// Junto con los esquemas de esta carpeta, es el único lugar del motor que conoce la forma exacta de esos archivos.

import type { Contenido } from '../../dominio/contenido.ts';
import type { DescripcionDeNivel } from '../../dominio/descripcion-de-nivel.ts';
import type { Manifiesto } from '../../dominio/manifiesto.ts';
import type { Lectura, LectorDeNiveles } from '../../puertos/lector-de-niveles.ts';
import { esquemaDeContenido } from './esquema-de-contenido.ts';
import { esquemaDeManifiesto } from './esquema-de-manifiesto.ts';
import { esquemaDeNivel } from './esquema-de-nivel.ts';
import { leerJsonConEsquema } from './leer-json-con-esquema.ts';

export class LectorDeNivelesDeJson implements LectorDeNiveles {
  leerDescripcionDeNivel(json: unknown): Lectura<DescripcionDeNivel> {
    return leerJsonConEsquema(esquemaDeNivel, json);
  }

  leerContenido(json: unknown): Lectura<Contenido> {
    return leerJsonConEsquema(esquemaDeContenido, json);
  }

  leerManifiesto(json: unknown): Lectura<Manifiesto> {
    return leerJsonConEsquema(esquemaDeManifiesto, json);
  }
}
