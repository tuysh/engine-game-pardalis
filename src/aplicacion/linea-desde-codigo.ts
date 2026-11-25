// Arma el paso `dice` que pide una cinemática escrita en código con `escena.dice(...)`, revisando lo que
// el validador revisa en un nivel: la tarjeta de vocabulario completa y que existan las poses que nombra.

import type { AssetsDeNivel } from '../dominio/assets-de-nivel.ts';
import type { Contenido } from '../dominio/contenido.ts';
import { esObjetoPlano } from '../dominio/es-objeto-plano.ts';
import type { PalabraDeVocabulario, PasoDeLinea } from '../dominio/paso.ts';
import { problemaDeImagen } from '../dominio/revisar-assets.ts';
import type { OpcionesDeLinea } from '../puertos/cinematica-en-codigo.ts';

/** Lo que pidió la llamada a `escena.dice`. */
export interface LineaPedidaDesdeCodigo {
  readonly personaje: string;
  readonly texto: string;
  /** Desde JavaScript las opciones pueden llegar en `null` o no llegar. */
  readonly opciones: OpcionesDeLinea | null | undefined;
}

/** El paso ya armado, o por qué la llamada no se puede ejecutar. */
export type LineaDesdeCodigo =
  | { readonly tipo: 'linea'; readonly paso: PasoDeLinea }
  | { readonly tipo: 'problema'; readonly problema: string };

export function armarLineaDesdeCodigo(
  pedida: LineaPedidaDesdeCodigo,
  contenido: Contenido,
  assets: AssetsDeNivel,
): LineaDesdeCodigo {
  const { audio, trad, en, es, con, reacciona, piensa } = pedida.opciones ?? {};

  const soloTraeUnaMitad = (en === undefined) !== (es === undefined);
  if (soloTraeUnaMitad) {
    return { tipo: 'problema', problema: 'una tarjeta de vocabulario necesita "en" y "es" juntos' };
  }
  let palabra: PalabraDeVocabulario | undefined;
  if (en !== undefined && es !== undefined) {
    palabra = { en, es };
  }

  if (con !== undefined) {
    const problema = problemaDeImagen(con, assets);
    if (problema !== undefined) return { tipo: 'problema', problema: `"con": ${problema}` };
  }
  const reacciones = leerReacciones(reacciona);
  for (const personaje of Object.keys(reacciones)) {
    if (!Object.hasOwn(contenido.meta.personajes, personaje)) {
      return { tipo: 'problema', problema: `"reacciona": el personaje "${personaje}" no existe en meta.personajes` };
    }
    const problema = problemaDeImagen(reacciones[personaje]!, assets); // `personaje` viene de `Object.keys`
    if (problema !== undefined) return { tipo: 'problema', problema: `"reacciona": ${problema}` };
  }

  const paso: PasoDeLinea = {
    tipo: 'linea',
    hablante: pedida.personaje,
    texto: pedida.texto,
    traduccion: trad,
    palabra,
    audio,
    pose: con,
    reacciones,
    // Solo `true` cuenta: desde JavaScript podría llegar cualquier cosa.
    esPensamiento: piensa === true ? true : undefined,
  };
  return { tipo: 'linea', paso };
}

/** Lo que llega del host no es confiable: se conservan solo las reacciones que nombran una clave con texto. */
function leerReacciones(reacciona: unknown): Record<string, string> {
  const reacciones: Record<string, string> = {};
  if (!esObjetoPlano(reacciona)) return reacciones;

  for (const personaje of Object.keys(reacciona)) {
    if (personaje === '__proto__') continue;
    const clave = reacciona[personaje];
    if (typeof clave === 'string') {
      reacciones[personaje] = clave;
    }
  }
  return reacciones;
}
