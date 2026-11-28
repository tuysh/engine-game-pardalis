// La voz sintetizada del dispositivo (`speechSynthesis`): dice un texto con la voz que mejor habla su idioma
// (elegir-voz.ts) y con el tono y la velocidad de quien habla.
//
// El navegador entrega la lista de voces poco a poco: en Chrome, la primera vez que se pide llega vacía y
// avisa con `voiceschanged` cuando ya está. Por eso la lista se pide al crearse y se actualiza con ese aviso;
// si todavía no llegó, la frase sale solo con su acento (`lang`), como antes.
//
// Se verifica a mano en la demo; no tiene pruebas automáticas porque necesita un navegador con voz.

import type { AjustesDeVoz } from '../../dominio/ajustes-de-voz.ts';
import { VOZ_NORMAL } from '../../dominio/ajustes-de-voz.ts';
import type { Idioma } from '../../dominio/idioma.ts';
import type { ResultadoDeDecir } from '../../puertos/audio.ts';
import { elegirVoz } from './elegir-voz.ts';

/** Con qué acento habla la voz sintetizada en cada idioma, si el dispositivo no tiene una voz de ese idioma. */
const ACENTO_POR_IDIOMA: Readonly<Record<Idioma, string>> = { es: 'es-MX', en: 'en-US' };

/** Una frase para la voz sintetizada. */
export interface FraseSintetizada {
  readonly texto: string;
  readonly idioma: Idioma;
  /** `undefined` = la voz normal. */
  readonly voz: AjustesDeVoz | undefined;
  /** De 0 a 1. */
  readonly volumen: number;
}

export class VozSintetizada {
  /** Las voces del dispositivo. Vacía mientras el navegador no las entrega. */
  private voces: readonly SpeechSynthesisVoice[] = [];
  /**
   * Las frases que se están diciendo. Se guardan aquí a propósito: algunos navegadores descartan una frase
   * que nadie más guarda, y entonces nunca avisan que terminó de decirse.
   */
  private readonly frasesEnCurso = new Set<SpeechSynthesisUtterance>();

  constructor() {
    if (!hayVozSintetizada()) return;
    this.voces = speechSynthesis.getVoices();
    speechSynthesis.addEventListener('voiceschanged', this.alCambiarLasVoces);
  }

  /**
   * Dice la frase. Termina con `'dicho'` al acabar o al cancelarse con `senal`, y con `'sin_voz'` si el
   * dispositivo no tiene voz sintetizada o no pudo decirla.
   */
  decir(frase: FraseSintetizada, senal: AbortSignal): Promise<ResultadoDeDecir> {
    if (!hayVozSintetizada() || frase.texto.trim() === '') {
      return Promise.resolve('sin_voz');
    }

    return new Promise((terminar) => {
      const enunciado = this.prepararEnunciado(frase);
      this.frasesEnCurso.add(enunciado);

      const finalizar = (resultado: ResultadoDeDecir): void => {
        this.frasesEnCurso.delete(enunciado);
        enunciado.onend = null;
        enunciado.onerror = null;
        senal.removeEventListener('abort', alCancelar);
        terminar(resultado);
      };
      const alCancelar = (): void => {
        speechSynthesis.cancel();
        finalizar('dicho');
      };

      enunciado.onend = (): void => finalizar('dicho');
      // Un error aquí significa que el dispositivo no pudo decir la frase: cuenta como no tener voz.
      enunciado.onerror = (): void => finalizar('sin_voz');
      senal.addEventListener('abort', alCancelar, { once: true });
      speechSynthesis.speak(enunciado);
    });
  }

  /** Calla lo que se esté diciendo y deja de escuchar al navegador. */
  destruir(): void {
    if (!hayVozSintetizada()) return;
    speechSynthesis.removeEventListener('voiceschanged', this.alCambiarLasVoces);
    speechSynthesis.cancel();
  }

  private prepararEnunciado(frase: FraseSintetizada): SpeechSynthesisUtterance {
    const enunciado = new SpeechSynthesisUtterance(frase.texto);
    const ajustes = frase.voz ?? VOZ_NORMAL;
    enunciado.lang = ACENTO_POR_IDIOMA[frase.idioma];
    enunciado.pitch = ajustes.tono;
    enunciado.rate = ajustes.velocidad;
    enunciado.volume = frase.volumen;
    const voz = elegirVoz(this.voces, frase.idioma);
    if (voz !== undefined) {
      enunciado.voice = voz;
      // El acento de la voz elegida manda: así una voz "es-US" no recibe la etiqueta "es-MX".
      enunciado.lang = voz.lang;
    }
    return enunciado;
  }

  // Se guarda como propiedad (y no como método) para poder quitarla con `removeEventListener`.
  private readonly alCambiarLasVoces = (): void => {
    this.voces = speechSynthesis.getVoices();
  };
}

/** Algunos navegadores y dispositivos no traen voz sintetizada. */
export function hayVozSintetizada(): boolean {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
}
