// El manifiesto de assets: la lista de imágenes, animaciones, sonidos y videos de una carpeta,
// cada uno con su clave (docs/DISENO-3.0.md §8.1). Es el contenido del archivo `assets.json`,
// que nadie escribe a mano: lo genera `escenario-engine assets <carpeta>`.
//
// La clave de un asset es el nombre de su archivo sin extensión: `img/spr_mama.svg` → `spr_mama`.

/** El tamaño de una imagen, en píxeles de su dibujo original. */
export interface Medidas {
  readonly anchoEnPixeles: number;
  readonly altoEnPixeles: number;
}

/** Una imagen fija. */
export interface AssetDeImagen extends Medidas {
  readonly tipo: 'imagen';
  /** Ruta del archivo dentro de la carpeta de assets. Ejemplo: `img/spr_mama.svg`. */
  readonly archivo: string;
}

/** Una animación: varias imágenes del mismo tamaño que se muestran una tras otra. */
export interface AssetDeAnimacion extends Medidas {
  readonly tipo: 'animacion';
  /** Rutas de los cuadros, en el orden en que se muestran. */
  readonly cuadros: readonly string[];
  readonly cuadrosPorSegundo: number;
}

export interface AssetDeAudio {
  readonly tipo: 'audio';
  readonly archivo: string;
}

export interface AssetDeVideo {
  readonly tipo: 'video';
  readonly archivo: string;
}

export type Asset = AssetDeImagen | AssetDeAnimacion | AssetDeAudio | AssetDeVideo;

/** Los assets de una carpeta, por clave. */
export type Manifiesto = Readonly<Record<string, Asset>>;

/** Los ajustes opcionales que el generador del manifiesto lee de `assets.config.json`. */
export interface ConfiguracionDeAssets {
  /** Velocidad de cada animación que no usa la velocidad por defecto, por clave. */
  readonly cuadrosPorSegundo: Readonly<Record<string, number>>;
}

/** Velocidad de una animación cuando `assets.config.json` no dice otra. */
export const CUADROS_POR_SEGUNDO_POR_DEFECTO = 8;

/** Nombre del archivo del manifiesto dentro de cada carpeta de assets. */
export const NOMBRE_DEL_MANIFIESTO = 'assets.json';

/** Nombre del archivo opcional con ajustes para el generador del manifiesto. */
export const NOMBRE_DE_LA_CONFIGURACION_DE_ASSETS = 'assets.config.json';
