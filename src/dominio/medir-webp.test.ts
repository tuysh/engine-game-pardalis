import { expect, test } from 'bun:test';
import { medirWebp } from './medir-webp.ts';

/** Arma el inicio de un WebP: «RIFF», el tamaño (aquí en ceros), «WEBP», el nombre del bloque y sus datos. */
function inicioDeWebp(nombreDelBloque: string, datosDesdeElByte20: number[]): Uint8Array {
  const bytes = new Uint8Array(32);
  bytes.set(new TextEncoder().encode('RIFF'), 0);
  bytes.set(new TextEncoder().encode('WEBP'), 8);
  bytes.set(new TextEncoder().encode(nombreDelBloque), 12);
  bytes.set(datosDesdeElByte20, 20);
  return bytes;
}

test('lee un WebP de la variante extendida (VP8X)', () => {
  // Desde el byte 24: «ancho menos 1» = 299 (0x00012b) y «alto menos 1» = 199 (0x0000c7), en 3 bytes cada uno.
  const bytes = inicioDeWebp('VP8X', [0, 0, 0, 0, 0x2b, 0x01, 0x00, 0xc7, 0x00, 0x00]);

  expect(medirWebp(bytes)).toEqual({ anchoEnPixeles: 300, altoEnPixeles: 200 });
});

test('lee un WebP de la variante con pérdida (VP8)', () => {
  // Desde el byte 26: ancho = 300 (0x012c) y alto = 200 (0x00c8), en 2 bytes cada uno.
  const bytes = inicioDeWebp('VP8 ', [0, 0, 0, 0x9d, 0x01, 0x2a, 0x2c, 0x01, 0xc8, 0x00]);

  expect(medirWebp(bytes)).toEqual({ anchoEnPixeles: 300, altoEnPixeles: 200 });
});

test('lee un WebP de la variante sin pérdida (VP8L)', () => {
  // Desde el byte 21, un entero de 4 bytes: 299 en los primeros 14 bits y 199 en los 14 siguientes.
  // 299 + 199 × 16384 = 3260715 = 0x0031c12b → bytes 2b c1 31 00.
  const bytes = inicioDeWebp('VP8L', [0x2f, 0x2b, 0xc1, 0x31, 0x00]);

  expect(medirWebp(bytes)).toEqual({ anchoEnPixeles: 300, altoEnPixeles: 200 });
});

test('un WebP con un bloque desconocido no se puede medir', () => {
  expect(medirWebp(inicioDeWebp('ABCD', []))).toBeUndefined();
});

test('unos bytes que no son WebP no se pueden medir', () => {
  const noEsWebp = inicioDeWebp('VP8X', []);
  noEsWebp[0] = 0x00;

  expect(medirWebp(noEsWebp)).toBeUndefined();
  expect(medirWebp(new Uint8Array(10))).toBeUndefined();
});
