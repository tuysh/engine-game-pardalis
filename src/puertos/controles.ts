// El puerto de los controles: lo que el jugador pide con el teclado (moverse y hablar).
// (Los toques y los clics llegan por el puerto Escenario, porque dependen de qué se tocó.)

/**
 * Una dirección sobre el plano del lugar. Cada eje vale -1, 0 o 1.
 * `x`: -1 = izquierda, 1 = derecha. `y`: -1 = hacia el fondo, 1 = hacia la cámara.
 */
export interface DireccionDeControl {
  readonly x: number;
  readonly y: number;
}

export interface Controles {
  /** La dirección que el jugador mantiene oprimida en este momento. `{ x: 0, y: 0 }` = ninguna. */
  leerDireccion(): DireccionDeControl;
  /**
   * Avisa cada vez que el jugador oprime la tecla de hablar: sirve para hablar con quien tenga cerca
   * o usar el objeto que tenga a la mano. Devuelve una función que deja de avisar.
   */
  alPedirHablar(funcion: () => void): () => void;
  /** Deja de escuchar el teclado. Se puede llamar más de una vez. */
  destruir(): void;
}
