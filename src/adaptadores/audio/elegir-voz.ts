// Elige, de las voces sintetizadas que trae el dispositivo, la que mejor dice un idioma.
//
// Sin esto, el navegador usa su voz por omisión y solo cambia el acento si puede: en un dispositivo
// en inglés, el español puede salir leído con una voz inglesa, que no se entiende.
//
// Preferencias:
//   - español: México (es-MX); si no hay, otro español de América (es-US, es-419); si no, cualquier español;
//   - inglés: Estados Unidos (en-US); si no hay, cualquier inglés.
// Entre voces igual de buenas gana la primera de la lista, que es el orden en que las da el navegador.

import type { Idioma } from '../../dominio/idioma.ts';

/** Lo que hace falta saber de una voz del dispositivo. `SpeechSynthesisVoice` lo cumple. */
export interface VozDisponible {
  /** Su idioma y región, como "es-MX". En Android a veces llega como "es_MX". */
  readonly lang: string;
}

/** Las regiones preferidas de cada idioma, de la mejor a la menos buena, en minúsculas. */
const REGIONES_PREFERIDAS: Readonly<Record<Idioma, readonly string[]>> = {
  es: ['es-mx', 'es-us', 'es-419'],
  en: ['en-us'],
};

/** Lo que se le da a una voz que es del idioma, pero de ninguna región preferida. */
const PUNTOS_DE_OTRA_REGION = 1;

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

  const regiones = REGIONES_PREFERIDAS[idioma];
  const posicion = regiones.indexOf(etiqueta);
  if (posicion < 0) return PUNTOS_DE_OTRA_REGION;
  // La primera región preferida vale más que la segunda, y cualquiera de ellas más que otra región.
  return PUNTOS_DE_OTRA_REGION + regiones.length - posicion;
}

/** "es_MX" y "ES-mx" se vuelven "es-mx". */
function normalizarEtiqueta(etiqueta: string): string {
  return etiqueta.replaceAll('_', '-').toLowerCase();
}
