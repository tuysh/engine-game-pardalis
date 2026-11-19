// Las opciones que recibe `crearEscenario()` (docs/DISENO-3.0.md §4).

import type { Idioma } from './dominio/idioma.ts';
import type { ProgresoDeCarga } from './dominio/progreso-de-carga.ts';
import type { CinematicaEnCodigo } from './puertos/cinematica-en-codigo.ts';
import type { Minijuego } from './puertos/minijuego.ts';

/** Opciones de `crearEscenario()`. Solo `nivel` es obligatoria. */
export interface OpcionesDeEscenario {
  /** Id de nivel → URL de su `nivel.json`. Se puede omitir si `nivel` ya es una URL. */
  readonly niveles?: Readonly<Record<string, string>>;
  /** Id del nivel inicial, o directamente la URL de un `nivel.json` si solo hay un nivel. */
  readonly nivel: string;
  /** Minijuegos por nombre, tal como los nombran los pasos `juego` de los niveles. */
  readonly minijuegos?: Readonly<Record<string, Minijuego>>;
  /** Cinemáticas escritas en código, por el nombre que usa el campo `codigo` del nivel. */
  readonly cinematicas?: Readonly<Record<string, CinematicaEnCodigo>>;
  /**
   * Partida a restaurar, tal como la entregó `juego.guardar()` o el evento `guardar`.
   * Es `unknown` porque viene de afuera: si está corrupta o es de otra versión, se ignora con advertencia.
   */
  readonly partida?: unknown;
  /** Carpeta o CDN donde están los assets. Por defecto, junto a cada `nivel.json`. */
  readonly raizDeAssets?: string;
  /** Orígenes HTTPS externos permitidos (el CDN). Por defecto, ninguno. */
  readonly origenesPermitidos?: readonly string[];
  /** Idioma base de la interfaz. Por defecto `'es'`. */
  readonly idioma?: Idioma;
  /**
   * Quién da el primer toque que desbloquea el audio. Con `'boton'` (por defecto) el motor muestra
   * un botón grande de jugar; con `'host'` el host garantiza que ya hubo un toque.
   */
  readonly iniciarCon?: 'boton' | 'host';
  /** Modo salón de clases: todo más grande. Por defecto `false`. */
  readonly proyeccion?: boolean;
  /**
   * Avisa el avance de la carga de las imágenes de cada nivel (el primero y los que se carguen después),
   * para que el host dibuje su propia barra: una vez al empezar (0 de `total`) y otra por cada archivo.
   */
  readonly alCargar?: (progreso: ProgresoDeCarga) => void;
  /** Cancela la creación, por ejemplo si el componente del host se desmonta mientras carga. */
  readonly senal?: AbortSignal;
  /** Dibuja piso, huellas y zonas, y activa la cámara libre. Por defecto `false`. */
  readonly depurar?: boolean;
  /** Hace reproducible el azar. Sirve para pruebas. */
  readonly semilla?: number;
}
