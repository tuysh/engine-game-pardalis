// El audio del juego en el navegador: voces grabadas, sonidos y, cuando falta una voz, la voz sintetizada
// del dispositivo (voz-sintetizada.ts). Nada del juego requiere leer, así que una voz que falta nunca deja
// una línea en silencio si el dispositivo puede hablar.
//
// Cada cosa que suena es de un canal (música, voces o efectos) y suena con el volumen que el host eligió
// para ese canal (dominio/volumenes.ts). La pausa congela la música y los efectos; las voces no: la fila
// de voces (aplicacion/voz-en-orden.ts) corta la frase del juego al pausar y la repite al reanudar, y así
// lo que dice el host se oye aunque el juego esté en pausa.
//
// Se verifica a mano en la demo; no tiene pruebas automáticas porque necesita un navegador con sonido.

import type { CanalDeAudio, VolumenesDeAudio } from '../../dominio/volumenes.ts';
import { VOLUMENES_POR_DEFECTO, volumenDelCanal } from '../../dominio/volumenes.ts';
import type { Audio, FrasePorDecir, OpcionesDeSonido, ResultadoDeDecir } from '../../puertos/audio.ts';
import { VozSintetizada } from './voz-sintetizada.ts';

/** Qué tan fuerte suena la música de fondo: baja, para que no tape las voces. 1 = volumen completo. */
const VOLUMEN_DE_LA_MUSICA = 0.35;

/** Qué tan fuerte empieza un tono, y hasta dónde baja antes de apagarse. */
const VOLUMEN_INICIAL_DE_UN_TONO = 0.15;
const VOLUMEN_FINAL_DE_UN_TONO = 0.001;

/** Algo que está sonando: de qué canal es y qué tan fuerte se pidió (de 0 a 1, antes del volumen del canal). */
interface Sonando {
  readonly canal: CanalDeAudio;
  readonly volumenPropio: number;
}

/** Cómo reproducir un archivo. */
interface Reproduccion extends Sonando {
  /** Qué tan rápido (y agudo) suena. 1 = como está grabado. */
  readonly tono: number;
}

export class AudioDelNavegador implements Audio {
  /** Lo que está sonando ahora, para poder ajustarle el volumen, pausarlo y callarlo. */
  private readonly sonando = new Map<HTMLAudioElement, Sonando>();
  /** Los efectos que la pausa congeló: solo esos se reanudan. */
  private readonly congelados = new Set<HTMLAudioElement>();
  private readonly vozSintetizada = new VozSintetizada();
  private volumenes: VolumenesDeAudio = VOLUMENES_POR_DEFECTO;
  /** El reproductor de la música de fondo. `undefined` = no hay música puesta. */
  private musica: HTMLAudioElement | undefined;
  /** `true` mientras el juego está en pausa: la música que se ponga entonces espera a que se reanude. */
  private estaPausado = false;
  /** El generador de tonos del navegador. Se crea la primera vez que hace falta. */
  private contextoDeTonos: AudioContext | undefined;
  private estaDestruido = false;

  async decir(frase: FrasePorDecir, senal: AbortSignal): Promise<ResultadoDeDecir> {
    if (senal.aborted || this.estaDestruido) return 'dicho';

    if (frase.direccionDeLaVoz !== undefined) {
      const comoSeReproduce: Reproduccion = { canal: 'voces', volumenPropio: 1, tono: 1 };
      const seReprodujo = await this.reproducirGrabacion(frase.direccionDeLaVoz, comoSeReproduce, senal);
      if (seReprodujo) return 'dicho';
      console.warn(`[escenario-engine] no se pudo reproducir la voz ${frase.direccionDeLaVoz}; se usa voz sintetizada`);
    }
    const fraseSintetizada = {
      texto: frase.texto,
      idioma: frase.idioma,
      voz: frase.voz,
      volumen: volumenDelCanal(this.volumenes, 'voces'),
    };
    return this.vozSintetizada.decir(fraseSintetizada, senal);
  }

  tocar(direccionDelSonido: string, opciones?: OpcionesDeSonido): void {
    if (this.estaDestruido) return;
    const comoSeReproduce: Reproduccion = {
      canal: 'efectos',
      volumenPropio: opciones?.volumen ?? 1,
      tono: opciones?.tono ?? 1,
    };
    // No se espera a que termine: un sonido corto no detiene nada.
    const sinCortar = new AbortController().signal;
    void this.reproducirGrabacion(direccionDelSonido, comoSeReproduce, sinCortar).then((seReprodujo) => {
      if (!seReprodujo) {
        console.warn(`[escenario-engine] no se pudo reproducir el sonido ${direccionDelSonido}`);
      }
    });
  }

  tocarTono(frecuenciaEnHertz: number, duracionEnSegundos: number): void {
    if (this.estaDestruido || typeof AudioContext === 'undefined') return;
    const volumenDeLosEfectos = volumenDelCanal(this.volumenes, 'efectos');
    // Callado no se toca: además, la rampa de volumen de abajo no puede empezar en cero.
    if (volumenDeLosEfectos <= 0) return;
    if (this.contextoDeTonos === undefined) {
      this.contextoDeTonos = new AudioContext();
    }
    const contexto = this.contextoDeTonos;

    const oscilador = contexto.createOscillator();
    const volumen = contexto.createGain();
    oscilador.frequency.value = frecuenciaEnHertz;
    // Empieza suave y se apaga rápido, para que suene como un «tin» y no como un pitido.
    const ahora = contexto.currentTime;
    const volumenInicial = Math.max(VOLUMEN_FINAL_DE_UN_TONO, VOLUMEN_INICIAL_DE_UN_TONO * volumenDeLosEfectos);
    volumen.gain.setValueAtTime(volumenInicial, ahora);
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
    reproductor.volume = this.volumenDeLaMusica();
    this.musica = reproductor;
    if (this.estaPausado) return;
    // El navegador no deja sonar nada antes del primer toque: si rechaza, la música espera a ese toque.
    reproductor.play().catch(() => {
      window.addEventListener('pointerdown', this.empezarMusicaTrasElPrimerToque, { once: true });
    });
  }

  ajustarVolumenes(volumenes: VolumenesDeAudio): void {
    this.volumenes = volumenes;
    if (this.musica !== undefined) {
      this.musica.volume = this.volumenDeLaMusica();
    }
    for (const [reproductor, sonando] of this.sonando) {
      reproductor.volume = this.volumenDe(sonando);
    }
  }

  pausar(): void {
    this.estaPausado = true;
    for (const [reproductor, sonando] of this.sonando) {
      if (sonando.canal !== 'efectos' || reproductor.paused) continue;
      reproductor.pause();
      this.congelados.add(reproductor);
    }
    if (this.musica !== undefined) {
      this.musica.pause();
    }
  }

  reanudar(): void {
    this.estaPausado = false;
    if (this.musica !== undefined) {
      this.musica.play().catch((error: unknown) => {
        console.warn('[escenario-engine] no se pudo reanudar la música:', error);
      });
    }
    for (const reproductor of this.congelados) {
      // Si el navegador no deja reanudar, el sonido se queda en pausa; no hay nada más que hacer.
      reproductor.play().catch((error: unknown) => {
        console.warn('[escenario-engine] no se pudo reanudar un sonido:', error);
      });
    }
    this.congelados.clear();
  }

  destruir(): void {
    if (this.estaDestruido) return;
    this.ponerMusica(undefined);
    this.estaDestruido = true;
    for (const reproductor of this.sonando.keys()) {
      reproductor.pause();
    }
    this.sonando.clear();
    this.congelados.clear();
    if (this.contextoDeTonos !== undefined) {
      // Cerrar el generador de tonos no falla en la práctica; si fallara, no hay nada más que liberar.
      this.contextoDeTonos.close().catch((error: unknown) => {
        console.warn('[escenario-engine] no se pudo cerrar el generador de tonos:', error);
      });
      this.contextoDeTonos = undefined;
    }
    this.vozSintetizada.destruir();
  }

  private volumenDeLaMusica(): number {
    return VOLUMEN_DE_LA_MUSICA * volumenDelCanal(this.volumenes, 'musica');
  }

  private volumenDe(sonando: Sonando): number {
    return sonando.volumenPropio * volumenDelCanal(this.volumenes, sonando.canal);
  }

  // Se guarda como propiedad (y no como método) para poder quitarla con `removeEventListener`.
  private readonly empezarMusicaTrasElPrimerToque = (): void => {
    if (this.musica === undefined || this.estaPausado) return;
    this.musica.play().catch((error: unknown) => {
      console.warn('[escenario-engine] no se pudo reproducir la música:', error);
    });
  };

  /**
   * Reproduce un archivo de audio. Termina con `true` si sonó completo o si se canceló a media reproducción,
   * y con `false` si no se pudo reproducir (no existe, está dañado o el navegador no dejó).
   */
  private reproducirGrabacion(direccion: string, reproduccion: Reproduccion, senal: AbortSignal): Promise<boolean> {
    return new Promise((terminar) => {
      const reproductor = document.createElement('audio');
      const sonando = { canal: reproduccion.canal, volumenPropio: reproduccion.volumenPropio };
      this.sonando.set(reproductor, sonando);

      const finalizar = (seReprodujo: boolean): void => {
        reproductor.removeEventListener('ended', alTerminarDeSonar);
        reproductor.removeEventListener('error', alFallar);
        senal.removeEventListener('abort', alCancelar);
        this.sonando.delete(reproductor);
        this.congelados.delete(reproductor);
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
      reproductor.volume = this.volumenDe(sonando);
      // Sin esto, el navegador cambia la velocidad pero conserva la nota: el tono no subiría.
      reproductor.preservesPitch = false;
      // Al cargar el archivo, el navegador devuelve `playbackRate` a `defaultPlaybackRate`: hay que poner los dos.
      reproductor.defaultPlaybackRate = reproduccion.tono;
      reproductor.playbackRate = reproduccion.tono;
      reproductor.src = direccion;
      // `play()` rechaza si el archivo no sirve o si todavía no hubo un toque que desbloquee el sonido.
      reproductor.play().catch(alFallar);
    });
  }
}
