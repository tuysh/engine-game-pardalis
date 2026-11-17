// Lee un JSON que viene de afuera con un esquema de Zod y entrega una `Lectura`:
// el valor ya convertido al dominio, o la lista de problemas con la ruta de cada uno.

import { z } from 'zod';
import type { Lectura } from '../../puertos/lector-de-niveles.ts';
import { MENSAJES_EN_ESPANOL } from './mensajes-en-espanol.ts';
import { rutaLegible } from './ruta-legible.ts';

export function leerJsonConEsquema<Valor>(esquema: z.ZodType<Valor>, json: unknown): Lectura<Valor> {
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
