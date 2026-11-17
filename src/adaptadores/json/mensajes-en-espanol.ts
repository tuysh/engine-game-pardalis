// Los mensajes de error de Zod, en español.
// Se pasan en cada lectura (`esquema.safeParse(json, { error: MENSAJES_EN_ESPANOL })`) en vez de
// configurarlos para todo Zod, porque el host puede usar Zod por su cuenta y no debe cambiarle el idioma.

import { z } from 'zod';

export const MENSAJES_EN_ESPANOL = z.locales.es().localeError;
