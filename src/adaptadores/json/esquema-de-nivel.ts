// Cómo se escribe el archivo `nivel.json` (docs/DISENO-3.0.md §5.2):
//   { "mapa": "mapa.tmj", "contenido": "contenido.json", "assets": [".", "../comun"] }

import { z } from 'zod';
import type { DescripcionDeNivel } from '../../dominio/descripcion-de-nivel.ts';

export const esquemaDeNivel: z.ZodType<DescripcionDeNivel> = z.strictObject({
  mapa: z.string().min(1),
  contenido: z.string().min(1),
  assets: z.array(z.string().min(1)).default(['.']),
});
