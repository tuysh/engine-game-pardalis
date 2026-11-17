import { expect, test } from 'bun:test';
import { redactarInformeDeValidacion } from './redactar-informe-de-validacion.ts';

test('un nivel sin problemas se informa en una sola línea', () => {
  const lineas = redactarInformeDeValidacion('niveles/casa/nivel.json', { errores: [], advertencias: [] });

  expect(lineas).toEqual(['✓ niveles/casa/nivel.json es válido (0 errores, 0 advertencias)']);
});

test('las advertencias van primero y no quitan que el nivel sea válido', () => {
  const lineas = redactarInformeDeValidacion('nivel.json', { errores: [], advertencias: ['rama inalcanzable'] });

  expect(lineas).toEqual(['⚠ rama inalcanzable', '✓ nivel.json es válido (0 errores, 1 advertencia)']);
});

test('con errores, cada uno va en su línea y el nivel no es válido', () => {
  const lineas = redactarInformeDeValidacion('nivel.json', {
    errores: ['falta el hablante', 'falta la secuencia'],
    advertencias: ['rama inalcanzable'],
  });

  expect(lineas).toEqual([
    '⚠ rama inalcanzable',
    '✗ falta el hablante',
    '✗ falta la secuencia',
    '✗ nivel.json no es válido (2 errores, 1 advertencia)',
  ]);
});

test('un solo error se cuenta en singular', () => {
  const lineas = redactarInformeDeValidacion('nivel.json', { errores: ['falta el hablante'], advertencias: [] });

  expect(lineas).toEqual(['✗ falta el hablante', '✗ nivel.json no es válido (1 error, 0 advertencias)']);
});
