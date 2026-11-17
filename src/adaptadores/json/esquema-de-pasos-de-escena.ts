// Cómo se escriben en el JSON los pasos de escena (los que nacieron para las cinemáticas) y su conversión
// al `Paso` del dominio. La tabla de equivalencias está en src/dominio/paso.ts.
//
// Aquí están los que no llevan otros pasos dentro; `juntos`, que sí los lleva, está en esquema-de-pasos.ts.

import { z } from 'zod';
import type {
  Paso,
  PasoDeAnimacion,
  PasoDeAparicion,
  PasoDeCamara,
  PasoDeDesaparicion,
  PasoDeEspera,
  PasoDeFundido,
  PasoDeMirada,
  PasoDeMusica,
  PasoDeSalida,
  PasoDeSonido,
  PasoDeVideo,
} from '../../dominio/paso.ts';

/** Un paso se reconoce por una clave que solo él lleva; con ella se elige el esquema que lo lee. */
export interface FormaDePaso {
  readonly clave: string;
  readonly esquema: z.ZodType<Paso>;
}

const nombre = z.string().min(1);
const segundos = z.number().nonnegative();

const esquemaDeEspera = z
  .strictObject({ espera: segundos })
  .transform((json): PasoDeEspera => ({ tipo: 'espera', esperaEnSegundos: json.espera }));

const esquemaDeCamara = z
  .strictObject({ camara: nombre, duracion: segundos.default(0) })
  .transform((json): PasoDeCamara => ({ tipo: 'camara', destino: json.camara, duracionEnSegundos: json.duracion }));

const esquemaDeMirada = z
  .strictObject({ mira: nombre, hacia: nombre })
  .transform((json): PasoDeMirada => ({ tipo: 'mira', personaje: json.mira, hacia: json.hacia }));

const esquemaDeAnimacion = z
  .strictObject({ anima: nombre, con: nombre, repite: z.boolean().default(false) })
  .transform(
    (json): PasoDeAnimacion => ({ tipo: 'anima', personaje: json.anima, clave: json.con, repite: json.repite }),
  );

const esquemaDeAparicion = z
  .strictObject({ aparece: nombre, en: nombre })
  .transform((json): PasoDeAparicion => ({ tipo: 'aparece', personaje: json.aparece, punto: json.en }));

const esquemaDeDesaparicion = z
  .strictObject({ desaparece: nombre })
  .transform((json): PasoDeDesaparicion => ({ tipo: 'desaparece', personaje: json.desaparece }));

const esquemaDeMusica = z
  .strictObject({ musica: nombre })
  .transform((json): PasoDeMusica => ({ tipo: 'musica', clave: json.musica }));

const esquemaDeSonido = z
  .strictObject({ sonido: nombre })
  .transform((json): PasoDeSonido => ({ tipo: 'sonido', clave: json.sonido }));

const esquemaDeFundido = z
  .strictObject({ fundido: z.enum(['abrir', 'cerrar']), duracion: segundos.default(0) })
  .transform(
    (json): PasoDeFundido => ({ tipo: 'fundido', sentido: json.fundido, duracionEnSegundos: json.duracion }),
  );

// Un video sin voces se escribe con una sola clave; uno con voces, con una clave por idioma.
const esquemaDeVideo = z
  .strictObject({ video: z.union([nombre, z.strictObject({ es: nombre, en: nombre })]) })
  .transform((json): PasoDeVideo => {
    if (typeof json.video === 'string') {
      return { tipo: 'video', clavePorIdioma: { es: json.video, en: json.video } };
    }
    return { tipo: 'video', clavePorIdioma: json.video };
  });

const esquemaDeSalida = z
  .strictObject({ sale: nombre })
  .transform((json): PasoDeSalida => ({ tipo: 'sale', destino: json.sale }));

export const FORMAS_DE_PASOS_DE_ESCENA: readonly FormaDePaso[] = [
  { clave: 'espera', esquema: esquemaDeEspera },
  { clave: 'camara', esquema: esquemaDeCamara },
  { clave: 'mira', esquema: esquemaDeMirada },
  { clave: 'anima', esquema: esquemaDeAnimacion },
  { clave: 'aparece', esquema: esquemaDeAparicion },
  { clave: 'desaparece', esquema: esquemaDeDesaparicion },
  { clave: 'musica', esquema: esquemaDeMusica },
  { clave: 'sonido', esquema: esquemaDeSonido },
  { clave: 'fundido', esquema: esquemaDeFundido },
  { clave: 'video', esquema: esquemaDeVideo },
  { clave: 'sale', esquema: esquemaDeSalida },
];
