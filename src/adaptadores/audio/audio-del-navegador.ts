// El audio del juego en el navegador: voces grabadas, sonidos y, cuando falta una voz, la voz sintetizada
// del dispositivo. Nada del juego requiere leer, así que una voz que falta nunca deja una línea en silencio
// si el dispositivo puede hablar.
//
// Se verifica a mano en la demo; no tiene pruebas automáticas porque necesita un navegador con sonido.

import type { Idioma } from '../../dominio/idioma.ts';
import type { Audio, FrasePorDecir, ResultadoDeDecir } from '../../puertos/audio.ts';

/** Qué tan fuerte suena la música de fondo: baja, para que no tape las voces. 1 = volumen completo. */
const VOLUMEN_DE_LA_MUSICA = 0.35;

/** Qué tan fuerte empieza un tono, y hasta dónde baja antes de apagarse. */
const VOLUMEN_INICIAL_DE_UN_TONO = 0.15;
const VOLUMEN_FINAL_DE_UN_TONO = 0.001;

/** Con qué acento habla la voz sintetizada en cada idioma. */
const ACENTO_POR_IDIOMA: Readonly<Record<Idioma, string>> = { es: 'es-MX', en: 'en-US' };

export class AudioDelNavegador implements Audio {
  /** Lo que está sonando ahora, para poder pausarlo y callarlo. */
  private readonly sonando = new Set<HTMLAudioElement>();
  /** El reproductor de la música de fondo. `undefined` = no hay música puesta. */
  private musica: HTMLAudioElement | undefined;
  /** El generador de tonos del navegador. Se crea la primera vez que hace falta. */
  private contextoDeTonos: AudioContext | undefined;
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

  tocarTono(frecuenciaEnHertz: number, duracionEnSegundos: number): void {
    if (this.estaDestruido || typeof AudioContext === 'undefined') return;
    if (this.contextoDeTonos === undefined) {
      this.contextoDeTonos = new AudioContext();
    }
    const contexto = this.contextoDeTonos;

    const oscilador = contexto.createOscillator();
    const volumen = contexto.createGain();
    oscilador.frequency.value = frecuenciaEnHertz;
    // Empieza suave y se apaga rápido, para que suene como un «tin» y no como un pitido.
    const ahora = contexto.currentTime;
    volumen.gain.setValueAtTime(VOLUMEN_INICIAL_DE_UN_TONO, ahora);
    volumen.gain.exponentialRampToValueAtTime(VOLUMEN_FINAL_DE_UN_TONO, ahora + duracionEnSegundos);
    oscilador.connect(volumen);
    volumen.connect(contexto.destination);
    oscilador.start();
    oscilador.stop(ahora + duracionEnSegundos);
  }

  ponerMusica(direccionDeLaMusica: string | undefined): void {
    if (this.musica !== undefined) {
      this.musica.pause();
      window.removeEventListener('pointerdown', this.empezarMusicaTrasElPrimerToque);
      this.musica = undefined;
    }
    if (direccionDeLaMusica === undefined || this.estaDestruido) return;

    const reproductor = document.createElement('audio');
    reproductor.src = direccionDeLaMusica;
    reproductor.loop = true;
    reproductor.volume = VOLUMEN_DE_LA_MUSICA;
    this.musica = reproductor;
    // El navegador no deja sonar nada antes del primer toque: si rechaza, la música espera a ese toque.
    reproductor.play().catch(() => {
      window.addEventListener('pointerdown', this.empezarMusicaTrasElPrimerToque, { once: true });
    });
  }

  pausar(): void {
    for (const reproductor of this.sonando) {
      reproductor.pause();
    }
    if (this.musica !== undefined) {
      this.musica.pause();
    }
    if (hayVozSintetizada()) {
      speechSynthesis.pause();
    }
  }

  reanudar(): void {
    if (this.musica !== undefined) {
      this.musica.play().catch((error: unknown) => {
        console.warn('[escenario-engine] no se pudo reanudar la música:', error);
      });
    }
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
    this.ponerMusica(undefined);
    this.estaDestruido = true;
    for (const reproductor of this.sonando) {
      reproductor.pause();
    }
    this.sonando.clear();
    if (this.contextoDeTonos !== undefined) {
      // Cerrar el generador de tonos no falla en la práctica; si fallara, no hay nada más que liberar.
      this.contextoDeTonos.close().catch((error: unknown) => {
        console.warn('[escenario-engine] no se pudo cerrar el generador de tonos:', error);
      });
      this.contextoDeTonos = undefined;
    }
    if (hayVozSintetizada()) {
      speechSynthesis.cancel();
    }
  }

  // Se guarda como propiedad (y no como método) para poder quitarla con `removeEventListener`.
  private readonly empezarMusicaTrasElPrimerToque = (): void => {
    if (this.musica === undefined) return;
    this.musica.play().catch((error: unknown) => {
      console.warn('[escenario-engine] no se pudo reproducir la música:', error);
    });
  };

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
