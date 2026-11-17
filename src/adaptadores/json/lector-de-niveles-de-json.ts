// Lee los archivos JSON de un nivel con Zod y los convierte en tipos del dominio.
// Es el único lugar del motor que conoce la forma exacta de esos archivos.

import { z } from 'zod';
import type { Contenido } from '../../dominio/contenido.ts';
import type { DescripcionDeNivel } from '../../dominio/descripcion-de-nivel.ts';
import type { Lectura, LectorDeNiveles } from '../../puertos/lector-de-niveles.ts';
import { esquemaDeContenido } from './esquema-de-contenido.ts';
import { esquemaDeNivel } from './esquema-de-nivel.ts';
import { MENSAJES_EN_ESPANOL } from './mensajes-en-espanol.ts';
import { rutaLegible } from './ruta-legible.ts';

export class LectorDeNivelesDeJson implements LectorDeNiveles {
  leerDescripcionDeNivel(json: unknown): Lectura<DescripcionDeNivel> {
    return leer(esquemaDeNivel, json);
  }

  leerContenido(json: unknown): Lectura<Contenido> {
    return leer(esquemaDeContenido, json);
  }
}

function leer<Valor>(esquema: z.ZodType<Valor>, json: unknown): Lectura<Valor> {
  const resultado = esquema.safeParse(json, { error: MENSAJES_EN_ESPANOL });
  if (resultado.success) {
    return { tipo: 'leido', valor: resultado.data };
  }

  const errores: string[] = [];
  for (const problema of resultado.error.issues) {
    errores.push(`${rutaLegible(problema.path)}: ${problema.message}`);
  }
  return { tipo: 'invalido', errores };
}
