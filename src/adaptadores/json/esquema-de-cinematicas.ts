// Cómo se escribe la sección `cinematicas` del contenido (docs/DISENO-3.0.md §7.1) y su conversión
// a las `Cinematica` del dominio.
//
//   "intro": {
//     "inicia": "alEntrar",          // "alEntrar" | "manual" | { "zona": nombre } | { "objetivo": nombre }
//     "cuando": "no vista.intro",    // opcional; si falta, la cinemática se ve una sola vez
//     "saltable": true,              // opcional; por defecto sí se puede saltar
//     "pasos": [ ... ]               // o bien "codigo": "intro"
//   }

import { z } from 'zod';
import type { Condicion } from '../../dominio/condicion.ts';
import { PREFIJO_DE_VISTAS } from '../../dominio/contenido.ts';
import type { Cinematica, GuionDeCinematica, InicioDeCinematica } from '../../dominio/contenido.ts';
import { esObjetoPlano } from '../../dominio/es-objeto-plano.ts';
import { esquemaDeCondicion } from './esquema-de-condicion.ts';
import { esquemaDePaso } from './esquema-de-pasos.ts';

const MENSAJE_DE_INICIO = 'se espera "alEntrar", "manual", { "zona": nombre } o { "objetivo": nombre }';

const esquemaDeInicio: z.ZodType<InicioDeCinematica> = z.unknown().transform((json, contexto): InicioDeCinematica => {
  if (json === 'alEntrar') return { tipo: 'alEntrar' };
  if (json === 'manual') return { tipo: 'manual' };

  if (esObjetoPlano(json)) {
    const claves = Object.keys(json);
    const soloTraeUnaClave = claves.length === 1;
    if (soloTraeUnaClave && typeof json.zona === 'string' && json.zona !== '') {
      return { tipo: 'zona', zona: json.zona };
    }
    if (soloTraeUnaClave && typeof json.objetivo === 'string' && json.objetivo !== '') {
      return { tipo: 'objetivo', objetivo: json.objetivo };
    }
  }
  contexto.addIssue({ code: 'custom', message: MENSAJE_DE_INICIO });
  return z.NEVER;
});

const formaDeCinematica = z.strictObject({
  inicia: esquemaDeInicio,
  cuando: esquemaDeCondicion.optional(),
  saltable: z.boolean().default(true),
  pasos: z.array(esquemaDePaso).optional(),
  codigo: z.string().min(1).optional(),
});

/** Las cinemáticas se leen todas juntas porque cada una necesita su id (la clave) para su condición por defecto. */
export const esquemaDeCinematicas: z.ZodType<Record<string, Cinematica>> = z
  .record(z.string(), formaDeCinematica)
  .transform((cinematicasEnJson, contexto): Record<string, Cinematica> => {
    const cinematicas: Record<string, Cinematica> = {};

    for (const id of Object.keys(cinematicasEnJson)) {
      const json = cinematicasEnJson[id]!; // `id` viene de `Object.keys`, así que existe

      let guion: GuionDeCinematica | undefined;
      if (json.pasos !== undefined && json.codigo === undefined) {
        guion = { tipo: 'pasos', pasos: json.pasos };
      }
      if (json.codigo !== undefined && json.pasos === undefined) {
        guion = { tipo: 'codigo', nombre: json.codigo };
      }
      if (guion === undefined) {
        contexto.addIssue({
          code: 'custom',
          path: [id],
          message: 'una cinemática lleva "pasos" o "codigo": uno de los dos, ni ambos ni ninguno',
        });
        continue;
      }

      // Sin `cuando`, la cinemática solo empieza si todavía no se ha visto.
      const todaviaNoSeHaVisto: Condicion = {
        tipo: 'no',
        condicion: { tipo: 'variable', nombre: PREFIJO_DE_VISTAS + id },
      };
      cinematicas[id] = {
        inicio: json.inicia,
        condicion: json.cuando ?? todaviaNoSeHaVisto,
        saltable: json.saltable,
        guion,
      };
    }
    return cinematicas;
  });
