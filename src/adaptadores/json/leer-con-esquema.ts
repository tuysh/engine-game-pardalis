// Lee un dato con un esquema desde dentro de otro esquema, conservando la ruta de cada problema.
//
// Hace falta en los lugares donde el JSON admite varias formas (un paso puede ser una línea,
// una caminata, un minijuego...). Ahí primero se decide a mano cuál forma es y luego se lee
// con el esquema de esa forma: así el error dice qué le falta a ESE paso, y no un vago «entrada inválida».

import { z } from 'zod';
import { MENSAJES_EN_ESPANOL } from './mensajes-en-espanol.ts';

/**
 * Lee `json` con `esquema`. Si no tiene la forma esperada, anota cada problema en `contexto`
 * (el del esquema que llama) y devuelve `z.NEVER`, que es como Zod marca «aquí no hay valor».
 */
export function leerConEsquema<Valor>(
  esquema: z.ZodType<Valor>,
  json: unknown,
  contexto: z.core.$RefinementCtx,
): Valor {
  const resultado = esquema.safeParse(json, { error: MENSAJES_EN_ESPANOL });
  if (resultado.success) {
    return resultado.data;
  }
  for (const problema of resultado.error.issues) {
    contexto.addIssue({ code: 'custom', message: problema.message, path: problema.path });
  }
  return z.NEVER;
}
