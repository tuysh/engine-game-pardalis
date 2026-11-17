import { expect, test } from 'bun:test';
import { medirPng } from './medir-png.ts';

/** Los primeros 24 bytes de un PNG de 300 × 200: la firma, el bloque IHDR y sus dos tamaños. */
const INICIO_DE_UN_PNG_DE_300_POR_200 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // firma
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // largo del bloque y su nombre: "IHDR"
  0x00, 0x00, 0x01, 0x2c, // ancho: 300
  0x00, 0x00, 0x00, 0xc8, // alto: 200
]);

test('lee el ancho y el alto de un PNG', () => {
  expect(medirPng(INICIO_DE_UN_PNG_DE_300_POR_200)).toEqual({ anchoEnPixeles: 300, altoEnPixeles: 200 });
});

test('lee bien un PNG que es parte de un bloque de bytes más grande', () => {
  const bloqueMasGrande = new Uint8Array(40);
  bloqueMasGrande.set(INICIO_DE_UN_PNG_DE_300_POR_200, 10);
  const soloElPng = bloqueMasGrande.subarray(10, 34);

  expect(medirPng(soloElPng)).toEqual({ anchoEnPixeles: 300, altoEnPixeles: 200 });
});

test('unos bytes que no empiezan con la firma de PNG no se pueden medir', () => {
  const noEsPng = new Uint8Array(INICIO_DE_UN_PNG_DE_300_POR_200);
  noEsPng[0] = 0x00;

  expect(medirPng(noEsPng)).toBeUndefined();
});

test('un archivo cortado no se puede medir', () => {
  expect(medirPng(INICIO_DE_UN_PNG_DE_300_POR_200.subarray(0, 20))).toBeUndefined();
  expect(medirPng(new Uint8Array(0))).toBeUndefined();
});
