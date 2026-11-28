// Dice una frase en voz alta y espera a que termine, con un tope de tiempo para la voz sintetizada.
// Lo usan las líneas de un diálogo y los minijuegos: en los dos casos alguien espera a que la voz acabe,
// y una voz que nunca avisa que terminó no debe dejarlo esperando para siempre.

import type { Audio, FrasePorDecir, ResultadoDeDecir } from '../puertos/audio.ts';
import type { Reloj } from '../puertos/reloj.ts';

/**
 * Lo más que se espera a que la voz sintetizada termine una frase. Hay dispositivos cuya voz nunca avisa
 * que terminó; sin este tope, el globo de un comentario se quedaría en pantalla para siempre.
 * Es holgado: ninguna voz tarda tanto en decir la frase.
 */
const SEGUNDOS_MAXIMOS_DE_VOZ_POR_LETRA = 0.25;
const SEGUNDOS_MINIMOS_DEL_TOPE_DE_VOZ = 6;

/** Lo que hace falta para decir una frase. */
export interface PiezasParaDecir {
  /** Solo hace falta quien diga la frase: puede ser el audio o la fila de voces del host (voz-en-orden.ts). */
  readonly audio: Pick<Audio, 'decir'>;
  readonly reloj: Reloj;
}

/**
 * Dice una frase y espera a que termine, pero no más de un tiempo razonable si la dice la voz sintetizada.
 * Una voz grabada se espera completa: su archivo sí avisa cuando termina.
 */
export async function decirSinEsperarDeMas(
  frase: FrasePorDecir,
  senal: AbortSignal,
  piezas: PiezasParaDecir,
): Promise<ResultadoDeDecir> {
  if (frase.direccionDeLaVoz !== undefined) {
    return piezas.audio.decir(frase, senal);
  }

  // `tope` se dispara con lo primero que pase: que la voz termine, que se acabe el tiempo o que se cierre la línea.
  const tope = new AbortController();
  const alCerrarLaLinea = (): void => {
    tope.abort();
  };
  senal.addEventListener('abort', alCerrarLaLinea, { once: true });
  if (senal.aborted) {
    tope.abort();
  }

  const segundosDeTope = Math.max(SEGUNDOS_MINIMOS_DEL_TOPE_DE_VOZ, frase.texto.length * SEGUNDOS_MAXIMOS_DE_VOZ_POR_LETRA);
  try {
    const voz = piezas.audio.decir(frase, tope.signal);
    const tiempoAgotado = piezas.reloj.esperar(segundosDeTope, tope.signal).then((): ResultadoDeDecir => 'dicho');
    return await Promise.race([voz, tiempoAgotado]);
  } finally {
    senal.removeEventListener('abort', alCerrarLaLinea);
    // Calla la voz si se acabó el tiempo, o cancela la espera si la voz terminó antes.
    tope.abort();
  }
}
