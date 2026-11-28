// Cómo se escribe cada paso en el JSON de un nivel, y su conversión al `Paso` del dominio.
// La tabla de equivalencias está en src/dominio/paso.ts; la explicación para quien escribe niveles, en docs/NIVELES.md.

import { z } from 'zod';
import { esObjetoPlano } from '../../dominio/es-objeto-plano.ts';
import type {
  Opcion,
  PalabraDeVocabulario,
  Paso,
  PasoCondicional,
  PasoDeCaminata,
  PasoDeEfecto,
  PasoDeEleccion,
  PasoDeEstado,
  PasoDeJuntos,
  PasoDeLinea,
  PasoDeMinijuego,
  PasoDeSecuencia,
  PasosOSecuencia,
} from '../../dominio/paso.ts';
import { esquemaDeCondicion } from './esquema-de-condicion.ts';
import { FORMAS_DE_PASOS_DE_ESCENA } from './esquema-de-pasos-de-escena.ts';
import type { FormaDePaso } from './esquema-de-pasos-de-escena.ts';
import { leerConEsquema } from './leer-con-esquema.ts';

// Lo que un `pon` le hace a una variable: un valor fijo, o una suma o una resta a su número.
const esquemaDeCambio = z.union(
  [
    z.string(),
    z.number(),
    z.boolean(),
    z.strictObject({ suma: z.number() }),
    z.strictObject({ resta: z.number() }),
  ],
  { error: 'se espera un texto, un número, true, false, { "suma": número } o { "resta": número }' },
);

export const esquemaDeLinea: z.ZodType<PasoDeLinea> = z
  .strictObject({
    dice: z.string().min(1),
    texto: z.string(),
    trad: z.string().optional(),
    en: z.string().optional(),
    es: z.string().optional(),
    audio: z.string().optional(),
    con: z.string().min(1).optional(),
    reacciona: z.record(z.string(), z.string().min(1)).optional(),
    piensa: z.boolean().optional(),
  })
  .transform((json, contexto): PasoDeLinea => {
    const soloTraeUnaMitad = (json.en === undefined) !== (json.es === undefined);
    if (soloTraeUnaMitad) {
      contexto.addIssue({ code: 'custom', message: 'una tarjeta de vocabulario necesita "en" y "es" juntos' });
      return z.NEVER;
    }

    let palabra: PalabraDeVocabulario | undefined;
    if (json.en !== undefined && json.es !== undefined) {
      palabra = { en: json.en, es: json.es };
    }
    return {
      tipo: 'linea',
      hablante: json.dice,
      texto: json.texto,
      traduccion: json.trad,
      palabra,
      audio: json.audio,
      pose: json.con,
      reacciones: json.reacciona,
      esPensamiento: json.piensa,
    };
  });

// Los pasos se contienen unos a otros (un condicional lleva pasos dentro). Por eso los esquemas que
// nombran a `esquemaDePaso` se declaran con `z.lazy`: se arman hasta que se usan, cuando ya existe.
const esquemaDeListaDePasos: z.ZodType<Paso[]> = z.lazy(() => z.array(esquemaDePaso));

/** Una lista de pasos escrita en el lugar, o el nombre de una secuencia. */
export const esquemaDePasosOSecuencia: z.ZodType<PasosOSecuencia> = z
  .unknown()
  .transform((json, contexto): PasosOSecuencia => {
    if (typeof json === 'string' && json !== '') {
      return { tipo: 'secuencia', nombre: json };
    }
    if (Array.isArray(json)) {
      const pasos = leerConEsquema(esquemaDeListaDePasos, json, contexto);
      return { tipo: 'pasos', pasos };
    }
    contexto.addIssue({ code: 'custom', message: 'se espera una lista de pasos o el nombre de una secuencia' });
    return z.NEVER;
  });

const esquemaDeOpcion = z
  .strictObject({
    texto: z.string().optional(),
    trad: z.string().optional(),
    imagen: z.string().optional(),
    audio: z.string().optional(),
    cuando: esquemaDeCondicion.optional(),
    secuencia: esquemaDePasosOSecuencia,
  })
  .transform(
    (json): Opcion => ({
      texto: json.texto,
      traduccion: json.trad,
      imagen: json.imagen,
      audio: json.audio,
      condicion: json.cuando,
      alElegir: json.secuencia,
    }),
  );

const esquemaDeEleccion = z
  .strictObject({ elige: z.string(), opciones: z.array(esquemaDeOpcion).min(1) })
  .transform((json): PasoDeEleccion => ({ tipo: 'elige', pregunta: json.elige, opciones: json.opciones }));

const esquemaDeEfecto = z
  .strictObject({ efecto: z.string().min(1), sonido: z.string().min(1).optional() })
  .transform((json): PasoDeEfecto => ({ tipo: 'efecto', nombre: json.efecto, sonido: json.sonido }));

const esquemaDeEstado = z
  .strictObject({ pon: z.record(z.string(), esquemaDeCambio) })
  .transform((json): PasoDeEstado => ({ tipo: 'pon', valores: json.pon }));

const esquemaDeMinijuego = z
  .strictObject({ juego: z.string().min(1), config: z.unknown().optional() })
  .transform((json): PasoDeMinijuego => ({ tipo: 'juego', nombre: json.juego, config: json.config }));

const esquemaDeCaminata = z
  .strictObject({ camina: z.string().min(1), quien: z.string().min(1).optional() })
  .transform((json): PasoDeCaminata => ({ tipo: 'camina', punto: json.camina, personaje: json.quien }));

const esquemaDeSecuencia = z
  .strictObject({ secuencia: z.string().min(1) })
  .transform((json): PasoDeSecuencia => ({ tipo: 'secuencia', nombre: json.secuencia }));

const esquemaDeCondicional = z
  .strictObject({ cuando: esquemaDeCondicion, dice: esquemaDeListaDePasos })
  .transform((json): PasoCondicional => ({ tipo: 'condicional', condicion: json.cuando, pasos: json.dice }));

const esquemaDeJuntos = z
  .strictObject({ juntos: z.array(z.lazy(() => esquemaDePaso)).min(1) })
  .transform((json): PasoDeJuntos => ({ tipo: 'juntos', pasos: json.juntos }));

/**
 * Cada paso se reconoce por una clave que solo él lleva. El orden importa:
 * `cuando` va antes que `dice` porque un condicional también lleva `dice` (sus pasos de adentro).
 */
const FORMAS_DE_PASO: readonly FormaDePaso[] = [
  { clave: 'cuando', esquema: esquemaDeCondicional },
  { clave: 'elige', esquema: esquemaDeEleccion },
  { clave: 'juego', esquema: esquemaDeMinijuego },
  { clave: 'camina', esquema: esquemaDeCaminata },
  { clave: 'secuencia', esquema: esquemaDeSecuencia },
  { clave: 'efecto', esquema: esquemaDeEfecto },
  { clave: 'pon', esquema: esquemaDeEstado },
  { clave: 'juntos', esquema: esquemaDeJuntos },
  ...FORMAS_DE_PASOS_DE_ESCENA,
  { clave: 'dice', esquema: esquemaDeLinea },
];

export const esquemaDePaso: z.ZodType<Paso> = z.unknown().transform((json, contexto): Paso => {
  if (esObjetoPlano(json)) {
    for (const forma of FORMAS_DE_PASO) {
      if (Object.hasOwn(json, forma.clave)) {
        return leerConEsquema(forma.esquema, json, contexto);
      }
    }
  }

  const claves: string[] = [];
  for (const forma of FORMAS_DE_PASO) {
    claves.push(`"${forma.clave}"`);
  }
  contexto.addIssue({
    code: 'custom',
    message: `no se reconoce el paso: debe ser un objeto con una de estas claves: ${claves.join(', ')}`,
  });
  return z.NEVER;
});
