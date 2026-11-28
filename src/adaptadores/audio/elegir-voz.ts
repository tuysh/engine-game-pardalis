// Elige, de las voces sintetizadas que trae el dispositivo, la que mejor dice un idioma.
//
// Sin esto, el navegador usa su voz por omisión y solo cambia el acento si puede: en un dispositivo
// en inglés, el español puede salir leído con una voz inglesa, que no se entiende.
//
// Preferencias:
//   - español: México (es-MX); si no hay, otro español de América (es-US, es-419); si no, cualquier español;
//   - inglés: Estados Unidos (en-US); si no hay, cualquier inglés.
// Entre voces de la misma región gana la que el dispositivo marca como suya por omisión (`default`); si no,
// la primera de la lista, que es el orden en que las da el navegador.
//
// Las voces «de broma» de Apple (Albert, Bad News, Bells, Zarvox…) se descartan: en macOS y en iOS llegan
// marcadas como en-US y, por orden alfabético, antes que Samantha. Sin esto, Bobby podía hablar con burbujas.

import type { Idioma } from '../../dominio/idioma.ts';

/** Lo que hace falta saber de una voz del dispositivo. `SpeechSynthesisVoice` lo cumple. */
export interface VozDisponible {
  /** Su idioma y región, como "es-MX". En Android a veces llega como "es_MX". */
  readonly lang: string;
  /** Su nombre, como "Paulina". */
  readonly name: string;
  /** `true` si es la voz que el dispositivo usa por omisión. */
  readonly default: boolean;
}

/** Las regiones preferidas de cada idioma, de la mejor a la menos buena, en minúsculas. */
const REGIONES_PREFERIDAS: Readonly<Record<Idioma, readonly string[]>> = {
  es: ['es-mx', 'es-us', 'es-419'],
  en: ['en-us'],
};

/**
 * Los puntos de una voz: cada región preferida vale `PUNTOS_POR_REGION` más que la siguiente, y ser la voz
 * por omisión suma `PUNTOS_POR_SER_LA_VOZ_POR_OMISION`, que es menos: la región siempre pesa más.
 */
const PUNTOS_DE_OTRA_REGION = 10;
const PUNTOS_POR_REGION = 10;
const PUNTOS_POR_SER_LA_VOZ_POR_OMISION = 1;

/**
 * Las voces de efectos que traen macOS e iOS en inglés (cantan, susurran o suenan a robot), en minúsculas.
 * Ninguna sirve para que una niña o un niño entienda una palabra nueva.
 */
const VOCES_DE_BROMA: ReadonlySet<string> = new Set([
  'albert',
  'bad news',
  'bahh',
  'bells',
  'boing',
  'bubbles',
  'cellos',
  'deranged',
  'good news',
  'hysterical',
  'jester',
  'organ',
  'pipe organ',
  'superstar',
  'trinoids',
  'whisper',
  'wobble',
  'zarvox',
]);

/**
 * La voz que mejor dice `idioma`, o `undefined` si el dispositivo no tiene ninguna de ese idioma.
 * Un genérico porque se usa con las voces del navegador y, en las pruebas, con objetos a mano.
 */
export function elegirVoz<Voz extends VozDisponible>(voces: readonly Voz[], idioma: Idioma): Voz | undefined {
  let mejor: Voz | undefined;
  let puntosDeLaMejor = 0;
  for (const voz of voces) {
    const puntos = puntuarVoz(voz, idioma);
    if (puntos > puntosDeLaMejor) {
      mejor = voz;
      puntosDeLaMejor = puntos;
    }
  }
  return mejor;
}

/** Qué tan buena es una voz para un idioma: 0 = no es de ese idioma; más puntos, mejor. */
function puntuarVoz(voz: VozDisponible, idioma: Idioma): number {
  const etiqueta = normalizarEtiqueta(voz.lang);
  const esDelIdioma = etiqueta === idioma || etiqueta.startsWith(`${idioma}-`);
  if (!esDelIdioma) return 0;
  if (VOCES_DE_BROMA.has(voz.name.trim().toLowerCase())) return 0;

  let puntos = PUNTOS_DE_OTRA_REGION + puntosDeLaRegion(etiqueta, idioma);
  if (voz.default) {
    puntos += PUNTOS_POR_SER_LA_VOZ_POR_OMISION;
  }
  return puntos;
}

/** La primera región preferida vale más que la segunda, y cualquiera de ellas más que otra región (0). */
function puntosDeLaRegion(etiqueta: string, idioma: Idioma): number {
  const regiones = REGIONES_PREFERIDAS[idioma];
  const posicion = regiones.indexOf(etiqueta);
  if (posicion < 0) return 0;
  return (regiones.length - posicion) * PUNTOS_POR_REGION;
}

/** "es_MX" y "ES-mx" se vuelven "es-mx". */
function normalizarEtiqueta(etiqueta: string): string {
  return etiqueta.replaceAll('_', '-').toLowerCase();
}

/**
 * La etiqueta de idioma de una voz como la espera `SpeechSynthesisUtterance.lang`: "es_MX" de Android se
 * vuelve "es-MX" (con guion bajo, algunos navegadores no reconocen el idioma y leen con otro acento).
 */
export function etiquetaDeIdioma(voz: VozDisponible): string {
  return voz.lang.replaceAll('_', '-');
}
