// Lleva las razones por las que el juego está detenido. Hay tres, y ninguna deshace a las otras:
//   - alguien lo pausó: el host con `juego.pausar()`, o la cámara libre del modo depuración;
//   - la página está oculta: otra pestaña, la ventana minimizada, el teléfono bloqueado (`pausarAlOcultar`);
//   - todavía no tocan el botón de inicio (docs/DISENO-3.0.md §7.5).
// El tiempo del juego solo pasa cuando no queda ninguna. Lo que suena (audio y video) se calla con las dos
// primeras, pero no mientras se espera el inicio: ahí nada suena todavía.
//
// Por eso volver a la página nunca reanuda un juego que el host pausó, y `juego.reanudar()` con la página
// oculta no hace sonar nada hasta que la página se vuelve a ver.

/** Algo que se puede congelar y reanudar: el reloj, el audio, el video. */
export interface Pausable {
  pausar(): void;
  reanudar(): void;
}

export class PausaDelJuego {
  private readonly reloj: Pausable;
  private readonly loQueSuena: readonly Pausable[];
  private loPausaron = false;
  private estaOculta = false;
  private esperaElInicio = false;
  /** Lo último que se le pidió al reloj y a lo que suena: así cada uno recibe un pedido solo cuando cambia. */
  private relojDetenido = false;
  private loQueSuenaCallado = false;

  constructor(reloj: Pausable, loQueSuena: readonly Pausable[]) {
    this.reloj = reloj;
    this.loQueSuena = loQueSuena;
  }

  /** Congela el juego: el tiempo, el audio y el video. */
  pausar(): void {
    this.loPausaron = true;
    this.actualizar();
  }

  /** Quita la pausa pedida. Si la página está oculta o falta el botón de inicio, el juego sigue detenido. */
  reanudar(): void {
    this.loPausaron = false;
    this.actualizar();
  }

  /** La página dejó de verse: el juego se detiene hasta que `mostrarLaPagina()` lo avise. */
  ocultarLaPagina(): void {
    this.estaOculta = true;
    this.actualizar();
  }

  /** La página se ve otra vez. Solo quita la razón «oculta»: una pausa del host sigue en pie. */
  mostrarLaPagina(): void {
    this.estaOculta = false;
    this.actualizar();
  }

  /** Detiene el tiempo hasta que se llame a `empezar()`: se usa mientras se muestra el botón de inicio. */
  esperarElInicio(): void {
    this.esperaElInicio = true;
    this.actualizar();
  }

  /** El jugador tocó el botón de inicio: el tiempo empieza a pasar, salvo que haya otra razón para seguir detenido. */
  empezar(): void {
    this.esperaElInicio = false;
    this.actualizar();
  }

  /** Deja el reloj y lo que suena como piden las razones de este momento. */
  private actualizar(): void {
    const debeCallarse = this.loPausaron || this.estaOculta;
    if (debeCallarse !== this.loQueSuenaCallado) {
      this.loQueSuenaCallado = debeCallarse;
      for (const pausable of this.loQueSuena) {
        if (debeCallarse) {
          pausable.pausar();
        } else {
          pausable.reanudar();
        }
      }
    }

    const debeDetenerse = debeCallarse || this.esperaElInicio;
    if (debeDetenerse !== this.relojDetenido) {
      this.relojDetenido = debeDetenerse;
      if (debeDetenerse) {
        this.reloj.pausar();
      } else {
        this.reloj.reanudar();
      }
    }
  }
}
