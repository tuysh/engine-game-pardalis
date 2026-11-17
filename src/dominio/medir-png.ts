// Lee el tamaño de una imagen PNG a partir de sus primeros bytes.
//
// Todo PNG empieza igual: 8 bytes de firma y luego el bloque «IHDR», que guarda el ancho y el alto
// como dos enteros de 4 bytes. No hace falta entender más del formato para usar esta función.

import type { Medidas } from './manifiesto.ts';

/** Los 8 bytes con los que empieza todo archivo PNG. */
const FIRMA_DE_PNG: readonly number[] = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Posición, contando desde el inicio del archivo, del byte donde empieza cada dato. */
const POSICION_DEL_ANCHO = 16;
const POSICION_DEL_ALTO = 20;
const BYTES_NECESARIOS = 24;

/** El tamaño de la imagen, o `undefined` si los bytes no son de un PNG. */
export function medirPng(bytes: Uint8Array): Medidas | undefined {
  if (bytes.length < BYTES_NECESARIOS) return undefined;

  for (let i = 0; i < FIRMA_DE_PNG.length; i++) {
    if (bytes[i] !== FIRMA_DE_PNG[i]) return undefined;
  }

  // `DataView` lee enteros de varios bytes; en PNG el byte más significativo va primero (el modo por defecto).
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const anchoEnPixeles = vista.getUint32(POSICION_DEL_ANCHO);
  const altoEnPixeles = vista.getUint32(POSICION_DEL_ALTO);
  if (anchoEnPixeles === 0 || altoEnPixeles === 0) return undefined;

  return { anchoEnPixeles, altoEnPixeles };
}
