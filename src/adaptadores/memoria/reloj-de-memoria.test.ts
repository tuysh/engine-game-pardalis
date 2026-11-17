import { expect, test } from 'bun:test';
import { RelojDeMemoria } from './reloj-de-memoria.ts';

test('una espera no termina hasta que pasa su tiempo', async () => {
  const reloj = new RelojDeMemoria();
  const cancelador = new AbortController();
  let termino = false;

  void reloj.esperar(2, cancelador.signal).then(() => {
    termino = true;
  });

  await reloj.avanzar(1.9);
  expect(termino).toBe(false);

  await reloj.avanzar(0.1);
  expect(termino).toBe(true);
  expect(reloj.hayEsperasPendientes).toBe(false);
});

test('las esperas terminan en el orden en que vencen, no en el que se pidieron', async () => {
  const reloj = new RelojDeMemoria();
  const cancelador = new AbortController();
  const orden: string[] = [];

  void reloj.esperar(3, cancelador.signal).then(() => orden.push('larga'));
  void reloj.esperar(1, cancelador.signal).then(() => orden.push('corta'));

  await reloj.avanzar(5);

  expect(orden).toEqual(['corta', 'larga']);
});

test('un solo avance alcanza para varias esperas seguidas del mismo código', async () => {
  const reloj = new RelojDeMemoria();
  const cancelador = new AbortController();
  let pasosTerminados = 0;

  async function esperarTresVeces(): Promise<void> {
    for (let i = 0; i < 3; i++) {
      await reloj.esperar(1, cancelador.signal);
      pasosTerminados++;
    }
  }
  void esperarTresVeces();

  await reloj.avanzar(2);
  expect(pasosTerminados).toBe(2);

  await reloj.avanzar(1);
  expect(pasosTerminados).toBe(3);
});

test('al cancelar, la espera termina de inmediato sin rechazar y no queda pendiente', async () => {
  const reloj = new RelojDeMemoria();
  const cancelador = new AbortController();

  const espera = reloj.esperar(10, cancelador.signal);
  cancelador.abort();

  await expect(espera).resolves.toBeUndefined();
  expect(reloj.hayEsperasPendientes).toBe(false);
});

test('con una señal ya cancelada, la espera termina sin registrarse', async () => {
  const reloj = new RelojDeMemoria();
  const cancelador = new AbortController();
  cancelador.abort();

  await reloj.esperar(10, cancelador.signal);

  expect(reloj.hayEsperasPendientes).toBe(false);
});

test('una espera de cero segundos termina sin que pase el tiempo', async () => {
  const reloj = new RelojDeMemoria();
  const cancelador = new AbortController();

  await reloj.esperar(0, cancelador.signal);

  expect(reloj.hayEsperasPendientes).toBe(false);
});

test('avanzar con pasos decimales no deja una espera sin vencer por redondeo', async () => {
  const reloj = new RelojDeMemoria();
  const cancelador = new AbortController();
  let termino = false;

  void reloj.esperar(0.8, cancelador.signal).then(() => {
    termino = true;
  });

  // Sumar 0.1 ocho veces da 0.7999999999999999, un poco menos que 0.8.
  for (let i = 0; i < 8; i++) {
    await reloj.avanzar(0.1);
  }

  expect(termino).toBe(true);
});

test('cada avance cuenta como un cuadro para quien pidió enterarse', async () => {
  const reloj = new RelojDeMemoria();
  const cuadros: number[] = [];

  const cancelar = reloj.enCadaCuadro((segundos) => cuadros.push(segundos));
  await reloj.avanzar(0.016);
  await reloj.avanzar(0.02);
  cancelar();
  await reloj.avanzar(1);

  expect(cuadros).toEqual([0.016, 0.02]);
});
