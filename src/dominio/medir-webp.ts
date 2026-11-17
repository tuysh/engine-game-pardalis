// Lee el tamaño de una imagen WebP a partir de sus primeros bytes.
//
// Un WebP empieza con «RIFF», cuatro bytes de tamaño y «WEBP». Después viene un bloque cuyo nombre dice
// cuál de las tres variantes del formato es, y cada variante guarda el ancho y el alto en un lugar distinto.
// No hace falta entender las operaciones de bits de abajo para usar `medirWebp`: solo copian lo que
// dice la especificación del formato (https://developers.google.com/speed/webp/docs/riff_container).

import type { Medidas } from './manifiesto.ts';

const POSICION_DE_RIFF = 0;
const POSICION_DE_WEBP = 8;
const POSICION_DEL_NOMBRE_DEL_BLOQUE = 12;
const BYTES_NECESARIOS = 30;

/** Deja solo los 14 bits más bajos de un número: en las variantes simples, el tamaño ocupa 14 bits. */
const MASCARA_DE_14_BITS = 0x3fff;

/** El tamaño de la imagen, o `undefined` si los bytes no son de un WebP que se pueda medir. */
export function medirWebp(bytes: Uint8Array): Medidas | undefined {
  if (bytes.length < BYTES_NECESARIOS) return undefined;
  if (leerTexto(bytes, POSICION_DE_RIFF) !== 'RIFF') return undefined;
  if (leerTexto(bytes, POSICION_DE_WEBP) !== 'WEBP') return undefined;

  // En WebP el byte menos significativo va primero: por eso las lecturas llevan `true`.
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const nombreDelBloque = leerTexto(bytes, POSICION_DEL_NOMBRE_DEL_BLOQUE);

  switch (nombreDelBloque) {
    // Variante extendida: guarda «ancho menos 1» y «alto menos 1» en 3 bytes cada uno.
    case 'VP8X':
      return {
        anchoEnPixeles: leerEnteroDe3Bytes(bytes, 24) + 1,
        altoEnPixeles: leerEnteroDe3Bytes(bytes, 27) + 1,
      };

    // Variante con pérdida: ancho y alto en 2 bytes cada uno, de los que solo cuentan 14 bits.
    case 'VP8 ':
      return {
        anchoEnPixeles: vista.getUint16(26, true) & MASCARA_DE_14_BITS,
        altoEnPixeles: vista.getUint16(28, true) & MASCARA_DE_14_BITS,
      };

    // Variante sin pérdida: un entero de 4 bytes lleva «ancho menos 1» en sus primeros 14 bits
    // y «alto menos 1» en los 14 siguientes.
    case 'VP8L': {
      const datos = vista.getUint32(21, true);
      const anchoMenosUno = datos & MASCARA_DE_14_BITS;
      const altoMenosUno = (datos >>> 14) & MASCARA_DE_14_BITS;
      return { anchoEnPixeles: anchoMenosUno + 1, altoEnPixeles: altoMenosUno + 1 };
    }

    default:
      return undefined;
  }
}

/** Lee las 4 letras que hay a partir de una posición. Ejemplo: los primeros 4 bytes de un WebP dan `'RIFF'`. */
function leerTexto(bytes: Uint8Array, posicion: number): string {
  const letras = bytes.subarray(posicion, posicion + 4);
  return String.fromCharCode(...letras);
}

/** Lee un entero guardado en 3 bytes, con el menos significativo primero. */
function leerEnteroDe3Bytes(bytes: Uint8Array, posicion: number): number {
  const byteBajo = bytes[posicion]!; // quien llama ya comprobó que hay bytes suficientes
  const byteMedio = bytes[posicion + 1]!;
  const byteAlto = bytes[posicion + 2]!;
  return byteBajo + byteMedio * 256 + byteAlto * 65_536;
}
