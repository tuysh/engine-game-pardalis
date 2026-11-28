// `juego.decir(texto, opciones)`: el host dice algo en voz alta con la voz del motor, por ejemplo una palabra
// de su cuaderno o lo que dice su pantalla final (docs/DISENO-3.0.md §4, «El objeto `juego`»).
//
// Por qué pasa por el motor y no directo por la voz del navegador: así espera su turno en la misma fila que
// las líneas del juego (voz-en-orden.ts) y no se encima con ellas ni las corta; y se oye aunque el juego
// esté en pausa, que es cuando el host suele mostrar lo suyo.
//
// Reglas:
// - Del host se dice una frase a la vez: una frase nueva corta la anterior del host (no las del juego).
// - `juego.callar()` corta la frase del host que se esté diciendo o esperando su turno; nunca las del juego.
// - La promesa termina cuando acaba de hablar, cuando la corta otra frase del host, `juego.callar()` o la
//   destrucción del juego. Rechaza solo si el host la llamó mal, con un `ErrorDeEscenario` que nombra `juego.decir`.
// - Con `quien`, la frase suena con la voz de ese personaje del nivel (`meta.personajes.<id>.voz`). Si además
//   llega `voz`, gana `voz`: es lo más concreto que pidió el host. Un id que el nivel no tiene no es un error
//   (el host puede pasar de un nivel a otro con la misma tabla): se avisa una vez y se usa la voz normal.

import { TONO_MAXIMO, TONO_MINIMO, VELOCIDAD_MAXIMA, VELOCIDAD_MINIMA, VOZ_NORMAL } from '../dominio/ajustes-de-voz.ts';
import type { AjustesDeVoz } from '../dominio/ajustes-de-voz.ts';
import { describirValor } from '../dominio/describir-valor.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { esObjetoPlano } from '../dominio/es-objeto-plano.ts';
import type { Idioma } from '../dominio/idioma.ts';
import type { FrasePorDecir } from '../puertos/audio.ts';
import type { VocesDelNivel } from './voces-del-nivel.ts';
import type { VozEnOrden } from './voz-en-orden.ts';

/** Lo que el host puede pedir al decir algo. */
export interface OpcionesParaDecir {
  /** En qué idioma está el texto: decide el acento de la voz sintetizada. */
  readonly idioma: Idioma;
  /** Clave de una voz grabada en los assets del nivel actual. Si falta o no está, se usa la voz sintetizada. */
  readonly clave?: string;
  /** Tono y velocidad de la voz sintetizada, como en `meta.personajes` (docs/NIVELES.md). `undefined` = normal. */
  readonly voz?: { readonly tono?: number; readonly velocidad?: number };
  /** Id de un personaje del nivel actual: se usa su voz de `meta.personajes`. Si también llega `voz`, gana `voz`. */
  readonly quien?: string;
}

/** Lo que la voz del host necesita del motor. */
export interface PiezasDeLaVozDelHost {
  /** La fila de voces: también pone el tope de tiempo si la voz del dispositivo nunca avisa que terminó. */
  readonly voz: Pick<VozEnOrden, 'decirDelHost'>;
  /**
   * Las voces del nivel actual: la grabada de una clave y la de cada personaje.
   * `undefined` = no hay un nivel en juego (mientras se pasa de uno a otro).
   */
  readonly vocesDelNivel: () => VocesDelNivel | undefined;
}

/** Lo que hay detrás de `juego.decir()`: revisa lo que pide el host y lo pone en la fila de voces. */
export class VozDelHost {
  private readonly piezas: PiezasDeLaVozDelHost;
  /** Corta la frase del host que se esté diciendo. */
  private cortarLaFraseAnterior: () => void = () => {};
  private readonly destruccion = new AbortController();

  constructor(piezas: PiezasDeLaVozDelHost) {
    this.piezas = piezas;
  }

  /**
   * Dice `texto` cuando le toque. Recibe `unknown` porque el host puede llamarla desde JavaScript sin tipos;
   * lo que no sirva rechaza con un `ErrorDeEscenario` que nombra `juego.decir`.
   */
  async decir(texto: unknown, opciones: unknown): Promise<void> {
    const frase = this.leerFrase(texto, opciones);
    this.cortarLaFraseAnterior();
    if (this.destruccion.signal.aborted) return;

    // `corte` se dispara con lo primero que pase: otra frase del host empieza, o el juego se destruye.
    const corte = new AbortController();
    const cortar = (): void => {
      corte.abort();
    };
    this.cortarLaFraseAnterior = cortar;
    this.destruccion.signal.addEventListener('abort', cortar, { once: true });
    try {
      await this.piezas.voz.decirDelHost(frase, corte.signal);
    } finally {
      this.destruccion.signal.removeEventListener('abort', cortar);
    }
  }

  /**
   * Corta la frase del host que se esté diciendo o que espere su turno; su promesa termina en ese momento.
   * Las líneas del juego siguen como iban. Sin una frase del host, no hace nada.
   */
  callar(): void {
    this.cortarLaFraseAnterior();
    this.cortarLaFraseAnterior = () => {};
  }

  /** Corta lo que el host esté diciendo y ya no dice nada más. */
  destruir(): void {
    this.destruccion.abort();
  }

  /** Revisa lo que mandó el host y lo convierte en una frase. Lanza `ErrorDeEscenario` si algo no sirve. */
  private leerFrase(texto: unknown, opciones: unknown): FrasePorDecir {
    if (typeof texto !== 'string') {
      throw new ErrorDeEscenario([`juego.decir: el texto debe ser un texto; llegó ${describirValor(texto)}`]);
    }
    if (!esObjetoPlano(opciones)) {
      throw new ErrorDeEscenario([
        `juego.decir("${texto}"): falta el segundo argumento, por ejemplo { idioma: 'en' }; ` +
          `llegó ${describirValor(opciones)}`,
      ]);
    }

    const problemas: string[] = [];
    const idioma = leerIdioma(opciones['idioma']);
    if (idioma === undefined) {
      problemas.push(
        `juego.decir("${texto}"): idioma debe ser "es" o "en"; llegó ${describirValor(opciones['idioma'])}`,
      );
    }
    const clave = opciones['clave'];
    if (clave !== undefined && typeof clave !== 'string') {
      problemas.push(`juego.decir("${texto}"): clave debe ser la clave de un asset; llegó ${describirValor(clave)}`);
    }
    const quien = opciones['quien'];
    if (quien !== undefined && typeof quien !== 'string') {
      problemas.push(
        `juego.decir("${texto}"): quien debe ser el id de un personaje del nivel; llegó ${describirValor(quien)}`,
      );
    }
    const voz = leerVoz(opciones['voz'], `juego.decir("${texto}")`, problemas);
    if (idioma === undefined || problemas.length > 0) {
      throw new ErrorDeEscenario(problemas);
    }

    const voces = this.piezas.vocesDelNivel();
    return {
      texto,
      idioma,
      voz: elegirVoz(voz, quien, voces),
      direccionDeLaVoz: buscarVozGrabada(clave, voces),
    };
  }
}

/** La voz que pidió el host con `voz` o, si no la pidió, la del personaje `quien`. */
function elegirVoz(
  voz: AjustesDeVoz | undefined,
  quien: unknown,
  voces: VocesDelNivel | undefined,
): AjustesDeVoz | undefined {
  if (voz !== undefined) return voz;
  if (typeof quien !== 'string' || voces === undefined) return undefined;
  return voces.vozDe(quien, 'juego.decir');
}

/** La dirección de la voz grabada `clave`. Entre un nivel y otro no hay assets: se usa la voz sintetizada. */
function buscarVozGrabada(clave: unknown, voces: VocesDelNivel | undefined): string | undefined {
  if (typeof clave !== 'string' || voces === undefined) return undefined;
  return voces.direccionDeVoz(clave, 'juego.decir');
}

function leerIdioma(idioma: unknown): Idioma | undefined {
  if (idioma === 'es' || idioma === 'en') return idioma;
  return undefined;
}

/** Lee el tono y la velocidad que pidió el host. Anota en `problemas` lo que no sirva. */
function leerVoz(voz: unknown, llamada: string, problemas: string[]): AjustesDeVoz | undefined {
  if (voz === undefined) return undefined;
  if (!esObjetoPlano(voz)) {
    problemas.push(`${llamada}: voz debe ser un objeto como { tono: 1.2 }; llegó ${describirValor(voz)}`);
    return undefined;
  }
  const tono = leerAjuste(voz['tono'], { minimo: TONO_MINIMO, maximo: TONO_MAXIMO, normal: VOZ_NORMAL.tono });
  const velocidad = leerAjuste(voz['velocidad'], {
    minimo: VELOCIDAD_MINIMA,
    maximo: VELOCIDAD_MAXIMA,
    normal: VOZ_NORMAL.velocidad,
  });
  if (tono === undefined) {
    problemas.push(`${llamada}: voz.tono va de ${TONO_MINIMO} a ${TONO_MAXIMO}; llegó ${describirValor(voz['tono'])}`);
  }
  if (velocidad === undefined) {
    problemas.push(
      `${llamada}: voz.velocidad va de ${VELOCIDAD_MINIMA} a ${VELOCIDAD_MAXIMA}; ` +
        `llegó ${describirValor(voz['velocidad'])}`,
    );
  }
  if (tono === undefined || velocidad === undefined) return undefined;
  return { tono, velocidad };
}

/** Los límites de un ajuste de la voz y su valor cuando no se pide. */
interface LimitesDeAjuste {
  readonly minimo: number;
  readonly maximo: number;
  readonly normal: number;
}

/** El ajuste pedido, su valor normal si no se pidió, o `undefined` si lo pedido no sirve. */
function leerAjuste(valor: unknown, limites: LimitesDeAjuste): number | undefined {
  if (valor === undefined) return limites.normal;
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return undefined;
  if (valor < limites.minimo || valor > limites.maximo) return undefined;
  return valor;
}
