import { expect, test } from 'bun:test';
import { redactarInformeDeAssets } from './redactar-informe-de-assets.ts';

test('un manifiesto generado se informa con cuántos assets quedaron', () => {
  const lineas = redactarInformeDeAssets('niveles/casa', { errores: [], advertencias: [], cantidadDeAssets: 12 });

  expect(lineas).toEqual(['✓ niveles/casa/assets.json generado (12 assets, 0 advertencias)']);
});

test('las advertencias van antes y no impiden generar', () => {
  const lineas = redactarInformeDeAssets('niveles/casa', {
    errores: [],
    advertencias: ['img/cartel.svg: enlaza archivos externos'],
    cantidadDeAssets: 1,
  });

  expect(lineas).toEqual([
    '⚠ img/cartel.svg: enlaza archivos externos',
    '✓ niveles/casa/assets.json generado (1 asset, 1 advertencia)',
  ]);
});

test('con errores se dice que el archivo no se generó', () => {
  const lineas = redactarInformeDeAssets('niveles/casa', {
    errores: ['img/a.svg: el SVG no tiene viewBox'],
    advertencias: [],
    cantidadDeAssets: 0,
  });

  expect(lineas).toEqual([
    '✗ img/a.svg: el SVG no tiene viewBox',
    '✗ niveles/casa/assets.json no se generó (1 error, 0 advertencias)',
  ]);
});
