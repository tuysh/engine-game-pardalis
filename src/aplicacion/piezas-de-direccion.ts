// Lo que necesitan, además de las piezas de escena, los pasos que dirigen una escena:
// mover la cámara, fundir a negro, reproducir un video y salir del nivel.

import type { Video } from '../puertos/video.ts';
import type { CamaraDeEscena } from './camara-de-escena.ts';
import type { FundidoDePantalla } from './fundido-de-pantalla.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';

export interface PiezasDeDireccion {
  readonly escena: PiezasDeEscena;
  readonly camara: CamaraDeEscena;
  readonly fundido: FundidoDePantalla;
  readonly video: Video;
  /** Pide que el nivel termine hacia un destino en cuanto acabe la escena en curso. */
  readonly pedirSalida: (destino: string) => void;
  /** Cambia quién acompaña al jugador mientras explora. Con `undefined`, ya nadie lo acompaña. */
  readonly cambiarAcompanante: (personaje: string | undefined) => void;
}
