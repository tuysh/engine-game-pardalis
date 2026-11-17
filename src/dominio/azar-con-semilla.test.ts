import { expect, test } from 'bun:test';
import { crearAzarConSemilla } from './azar-con-semilla.ts';

test('la misma semilla da siempre la misma serie de números', () => {
  const uno = crearAzarConSemilla(7);
  const otro = crearAzarConSemilla(7);

  const serieDeUno = [uno(), uno(), uno(), uno()];
  const serieDeOtro = [otro(), otro(), otro(), otro()];

  expect(serieDeUno).toEqual(serieDeOtro);
});

test('semillas distintas dan series distintas', () => {
  const uno = crearAzarConSemilla(7);
  const otro = crearAzarConSemilla(8);

  expect(uno()).not.toBe(otro());
});

test('todos los números quedan entre 0 (incluido) y 1 (sin incluir), y no se repiten enseguida', () => {
  const azar = crearAzarConSemilla(2026);
  const numeros = new Set<number>();

  for (let i = 0; i < 1000; i++) {
    const numero = azar();
    expect(numero).toBeGreaterThanOrEqual(0);
    expect(numero).toBeLessThan(1);
    numeros.add(numero);
  }

  expect(numeros.size).toBeGreaterThan(990);
});
