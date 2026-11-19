// Lleva las razones por las que el juego está detenido. Hay dos, y ninguna deshace a la otra:
//   - alguien lo pausó: el host con `juego.pausar()`, o la cámara libre del modo depuración;
//   - todavía no tocan el botón de inicio (docs/DISENO-3.0.md §7.5).
// El tiempo del juego solo pasa cuando no queda ninguna.

/** Algo que se puede congelar y reanudar: el reloj, el audio, el video. */
export interface Pausable {
  pausar(): void;
  reanudar(): void;
}

export class PausaDelJuego {
  private readonly reloj: Pausable;
  private readonly loQueSuena: readonly Pausable[];
  private loPausaron = false;
  private esperaElInicio = false;

  /** `loQueSuena` se calla con una pausa pedida, pero no mientras se espera el inicio: ahí nada suena todavía. */
  constructor(reloj: Pausable, loQueSuena: readonly Pausable[]) {
    this.reloj = reloj;
    this.loQueSuena = loQueSuena;
  }

  /** Congela el juego: el tiempo, el audio y el video. */
  pausar(): void {
    this.loPausaron = true;
    this.reloj.pausar();
    for (const pausable of this.loQueSuena) {
      pausable.pausar();
    }
  }

  /** Quita la pausa pedida. Si todavía no tocan el botón de inicio, el tiempo sigue detenido hasta ese toque. */
  reanudar(): void {
    this.loPausaron = false;
    for (const pausable of this.loQueSuena) {
      pausable.reanudar();
    }
    if (!this.esperaElInicio) {
      this.reloj.reanudar();
    }
  }

  /** Detiene el tiempo hasta que se llame a `empezar()`: se usa mientras se muestra el botón de inicio. */
  esperarElInicio(): void {
    this.esperaElInicio = true;
    this.reloj.pausar();
  }

  /** El jugador tocó el botón de inicio: el tiempo empieza a pasar, salvo que alguien tenga el juego en pausa. */
  empezar(): void {
    this.esperaElInicio = false;
    if (!this.loPausaron) {
      this.reloj.reanudar();
    }
  }
}
