// Mide una imagen de cualquiera de los formatos que el motor acepta, según la extensión de su archivo.

import type { Medidas } from './manifiesto.ts';
import { medirPng } from './medir-png.ts';
import { medirSvg } from './medir-svg.ts';
import { medirWebp } from './medir-webp.ts';
import { extensionDe } from './ruta-de-asset.ts';

/** El tamaño de la imagen, o `undefined` si no se pudo leer (archivo dañado, SVG sin `viewBox`…). */
export function medirImagen(ruta: string, bytes: Uint8Array): Medidas | undefined {
  switch (extensionDe(ruta)) {
    case '.svg':
      return medirSvg(new TextDecoder().decode(bytes));
    case '.png':
      return medirPng(bytes);
    case '.webp':
      return medirWebp(bytes);
    default:
      return undefined;
  }
}
