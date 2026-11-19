// El puerto del video: reproduce un video pregrabado a pantalla completa (docs/DISENO-3.0.md §7.4).

/** Cómo terminó un video. */
export type ResultadoDeVideo =
  /** Se vio completo, o se cortó porque la señal se disparó. */
  | 'visto'
  /** No se pudo reproducir: el archivo no sirve o el navegador no lo permitió. */
  | 'no_se_pudo';

export interface Video {
  /**
   * Reproduce un video encima del escenario. La promesa termina cuando el video acaba, en cuanto `senal`
   * se dispara (y entonces el video se quita) o si no se pudo reproducir. Nunca rechaza: un video que falla
   * no deja trabada una cinemática.
   */
  reproducir(direccionDelVideo: string, senal: AbortSignal): Promise<ResultadoDeVideo>;

  /** Congela y reanuda el video en curso, si hay uno. */
  pausar(): void;
  reanudar(): void;

  /** Quita el video en curso y libera lo que el puerto creó. Se puede llamar más de una vez. */
  destruir(): void;
}
