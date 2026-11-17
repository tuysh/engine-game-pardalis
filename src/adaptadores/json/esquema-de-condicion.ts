// Cómo se escribe una condición en el JSON de un nivel, y su conversión a la `Condicion` del dominio.
//
//   "tengo tortillas"            un texto (lo interpreta `leerCondicionDeTexto`)
//   ["a", "b"]                   una lista: se cumplen todas
//   { "alguno": ["a", "b"] }     se cumple alguna

import { z } from 'zod';
import { leerCondicionDeTexto } from '../../dominio/condicion.ts';
import type { Condicion } from '../../dominio/condicion.ts';

const MENSAJE_DE_FORMA = 'se espera una condición: un texto, una lista de condiciones o { "alguno": [...] }';

// Una condición puede llevar otras condiciones dentro, por eso se declara con `z.lazy`:
// el esquema se arma hasta que se usa, cuando `esquemaDeCondicion` ya existe.
export const esquemaDeCondicion: z.ZodType<Condicion> = z.lazy(() =>
  z.union(
    [
      z.string().min(1).transform(leerCondicionDeTexto),
      z.array(esquemaDeCondicion).transform((condiciones): Condicion => ({ tipo: 'todas', condiciones })),
      z
        .strictObject({ alguno: z.array(esquemaDeCondicion).min(1) })
        .transform((json): Condicion => ({ tipo: 'alguna', condiciones: json.alguno })),
    ],
    { error: MENSAJE_DE_FORMA },
  ),
);
