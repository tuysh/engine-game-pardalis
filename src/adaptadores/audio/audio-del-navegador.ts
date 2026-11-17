// El audio del juego en el navegador: voces grabadas, sonidos y, cuando falta una voz, la voz sintetizada
// del dispositivo. Nada del juego requiere leer, así que una voz que falta nunca deja una línea en silencio
// si el dispositivo puede hablar.
//
// Se verifica a mano en la demo; no tiene pruebas automáticas porque necesita un navegador con sonido.

import type { Idioma } from '../../dominio/idioma.ts';
import type { Audio, FrasePorDecir, ResultadoDeDecir } from '../../puertos/audio.ts';

/** Con qué acento habla la voz sintetizada en cada idioma. */
const ACENTO_POR_IDIOMA: Readonly<Record<Idioma, string>> = { es: 'es-MX', en: 'en-US' };

export class AudioDelNavegador implements Audio {
  /** Lo que está sonando ahora, para poder pausarlo y callarlo. */
  private readonly sonando = new Set<HTMLAudioElement>();
  private estaDestruido = false;

  async decir(frase: FrasePorDecir, senal: AbortSignal): Promise<ResultadoDeDecir> {
    if (senal.aborted || this.estaDestruido) return 'dicho';

    if (frase.direccionDeLaVoz !== undefined) {
      const seReprodujo = await this.reproducirGrabacion(frase.direccionDeLaVoz, senal);
      if (seReprodujo) return 'dicho';
      console.warn(`[escenario-engine] no se pudo reproducir la voz ${frase.direccionDeLaVoz}; se usa voz sintetizada`);
    }
    return this.decirConVozSintetizada(frase.texto, frase.idioma, senal);
  }

  tocar(direccionDelSonido: string): void {
    if (this.estaDestruido) return;
    // No se espera a que termine: un sonido corto no detiene nada.
    void this.reproducirGrabacion(direccionDelSonido, new AbortController().signal).then((seReprodujo) => {
      if (!seReprodujo) {
        console.warn(`[escenario-engine] no se pudo reproducir el sonido ${direccionDelSonido}`);
      }
    });
  }

  pausar(): void {
    for (const reproductor of this.sonando) {
      reproductor.pause();
    }
    if (hayVozSintetizada()) {
      speechSynthesis.pause();
    }
  }

  reanudar(): void {
    for (const reproductor of this.sonando) {
      // Si el navegador no deja reanudar, el sonido se queda en pausa; no hay nada más que hacer.
      reproductor.play().catch((error: unknown) => {
        console.warn('[escenario-engine] no se pudo reanudar un sonido:', error);
      });
    }
    if (hayVozSintetizada()) {
      speechSynthesis.resume();
    }
  }

  destruir(): void {
    if (this.estaDestruido) return;
    this.estaDestruido = true;
    for (const reproductor of this.sonando) {
      reproductor.pause();
    }
    this.sonando.clear();
    if (hayVozSintetizada()) {
      speechSynthesis.cancel();
    }
  }

  /**
   * Reproduce un archivo de audio. Termina con `true` si sonó completo o si se canceló a media reproducción,
   * y con `false` si no se pudo reproducir (no existe, está dañado o el navegador no dejó).
   */
  private reproducirGrabacion(direccion: string, senal: AbortSignal): Promise<boolean> {
    return new Promise((terminar) => {
      const reproductor = document.createElement('audio');
      this.sonando.add(reproductor);

      const finalizar = (seReprodujo: boolean): void => {
        reproductor.removeEventListener('ended', alTerminarDeSonar);
        reproductor.removeEventListener('error', alFallar);
        senal.removeEventListener('abort', alCancelar);
        this.sonando.delete(reproductor);
        terminar(seReprodujo);
      };
      const alTerminarDeSonar = (): void => finalizar(true);
      const alFallar = (): void => finalizar(false);
      const alCancelar = (): void => {
        reproductor.pause();
        finalizar(true);
      };

      reproductor.addEventListener('ended', alTerminarDeSonar);
      reproductor.addEventListener('error', alFallar);
      senal.addEventListener('abort', alCancelar, { once: true });
      reproductor.src = direccion;
      // `play()` rechaza si el archivo no sirve o si todavía no hubo un toque que desbloquee el sonido.
      reproductor.play().catch(alFallar);
    });
  }

  private decirConVozSintetizada(texto: string, idioma: Idioma, senal: AbortSignal): Promise<ResultadoDeDecir> {
    if (!hayVozSintetizada() || texto.trim() === '') {
      return Promise.resolve('sin_voz');
    }

    return new Promise((terminar) => {
      const frase = new SpeechSynthesisUtterance(texto);
      frase.lang = ACENTO_POR_IDIOMA[idioma];

      const finalizar = (resultado: ResultadoDeDecir): void => {
        frase.onend = null;
        frase.onerror = null;
        senal.removeEventListener('abort', alCancelar);
        terminar(resultado);
      };
      const alCancelar = (): void => {
        speechSynthesis.cancel();
        finalizar('dicho');
      };

      frase.onend = (): void => finalizar('dicho');
      // Un error aquí significa que el dispositivo no pudo decir la frase: cuenta como no tener voz.
      frase.onerror = (): void => finalizar('sin_voz');
      senal.addEventListener('abort', alCancelar, { once: true });
      speechSynthesis.speak(frase);
    });
  }
}

/** Algunos navegadores y dispositivos no traen voz sintetizada. */
function hayVozSintetizada(): boolean {
  return typeof speechSynthesis !== 'undefined' && typeof SpeechSynthesisUtterance !== 'undefined';
}
