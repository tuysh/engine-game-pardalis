// El puerto de los controles: hacia dónde pide moverse el jugador con el teclado.
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
  /** Deja de escuchar el teclado. Se puede llamar más de una vez. */
  destruir(): void;
}
