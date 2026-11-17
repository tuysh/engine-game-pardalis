// Lo que dice el archivo `nivel.json`: de qué archivos se compone un nivel (docs/DISENO-3.0.md §5.2).
// Todas las rutas son relativas al propio `nivel.json`.

export interface DescripcionDeNivel {
  /** Ruta del mapa de Tiled. Ejemplo: `"mapa.tmj"`. */
  readonly mapa: string;
  /** Ruta del contenido. Ejemplo: `"contenido.json"`. */
  readonly contenido: string;
  /** Carpetas donde están los assets del nivel. Ejemplo: `[".", "../comun"]`. */
  readonly assets: readonly string[];
}
