import { expect, test } from 'bun:test';
import { EsperaParaVolverAHablar, MILISEGUNDOS_SIN_HABLAR_TRAS_SEGUIR_UN_DIALOGO } from './espera-para-volver-a-hablar.ts';

test('sin haber seguido ningún diálogo, la tecla de hablar habla desde el principio', () => {
  const espera = new EsperaParaVolverAHablar();
  expect(espera.puedeHablar(0)).toBe(true);
});

test('el segundo Enter de un doble toque que cerró la última línea no empieza otra plática', () => {
  const espera = new EsperaParaVolverAHablar();
  // El primer Enter lo atendió la interfaz: cerró la última línea.
  espera.anotarQueSeSiguioElDialogo(10_000);

  // El segundo llega 150 ms después, con el diálogo ya terminado.
  expect(espera.puedeHablar(10_150)).toBe(false);
  expect(espera.puedeHablar(10_000 + MILISEGUNDOS_SIN_HABLAR_TRAS_SEGUIR_UN_DIALOGO - 1)).toBe(false);
});

test('pasado el momento de descanso, la tecla de hablar vuelve a empezar pláticas', () => {
  const espera = new EsperaParaVolverAHablar();
  espera.anotarQueSeSiguioElDialogo(10_000);

  expect(espera.puedeHablar(10_000 + MILISEGUNDOS_SIN_HABLAR_TRAS_SEGUIR_UN_DIALOGO)).toBe(true);
});

test('cada línea que se sigue vuelve a empezar el descanso', () => {
  const espera = new EsperaParaVolverAHablar();
  espera.anotarQueSeSiguioElDialogo(10_000);
  espera.anotarQueSeSiguioElDialogo(10_400);

  expect(espera.puedeHablar(10_600)).toBe(false);
  expect(espera.puedeHablar(10_900)).toBe(true);
});

test('dice cuánto falta para volver a hablar, para que la capa de toque sepa cuándo esconderse', () => {
  const espera = new EsperaParaVolverAHablar();
  expect(espera.milisegundosQueFaltan(0)).toBe(0);

  espera.anotarQueSeSiguioElDialogo(10_000);
  expect(espera.milisegundosQueFaltan(10_200)).toBe(MILISEGUNDOS_SIN_HABLAR_TRAS_SEGUIR_UN_DIALOGO - 200);
  expect(espera.milisegundosQueFaltan(20_000)).toBe(0);
});
