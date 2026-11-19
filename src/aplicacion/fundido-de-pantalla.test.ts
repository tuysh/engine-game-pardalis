import { expect, test } from 'bun:test';
import { InterfazDeMemoria } from '../adaptadores/memoria/interfaz-de-memoria.ts';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import { FundidoDePantalla } from './fundido-de-pantalla.ts';

const SIN_CORTAR = new AbortController().signal;

function crearFundido() {
  const interfaz = new InterfazDeMemoria();
  const reloj = new RelojDeMemoria();
  const fundido = new FundidoDePantalla(interfaz, reloj);
  return { fundido, interfaz, reloj };
}

test('cerrar oscurece la pantalla poco a poco hasta dejarla negra', async () => {
  const { fundido, interfaz, reloj } = crearFundido();
  let termino = false;

  void fundido.fundir('cerrar', 2, SIN_CORTAR).then(() => {
    termino = true;
  });
  await reloj.avanzar(1);
  expect(interfaz.opacidadDelFundido).toBe(0.5);
  expect(termino).toBe(false);

  await reloj.avanzar(1);
  expect(interfaz.opacidadDelFundido).toBe(1);
  expect(termino).toBe(true);
});

test('abrir empieza en negro aunque la pantalla estuviera clara, y la aclara poco a poco', async () => {
  const { fundido, interfaz, reloj } = crearFundido();

  void fundido.fundir('abrir', 2, SIN_CORTAR);
  expect(interfaz.opacidadDelFundido).toBe(1);

  await reloj.avanzar(1);
  expect(interfaz.opacidadDelFundido).toBe(0.5);
  await reloj.avanzar(1);
  expect(interfaz.opacidadDelFundido).toBe(0);
});

test('sin duración, el fundido es de golpe', async () => {
  const { fundido, interfaz } = crearFundido();

  await fundido.fundir('cerrar', 0, SIN_CORTAR);

  expect(interfaz.opacidadDelFundido).toBe(1);
});

test('cerrar una pantalla que ya estaba negra termina de inmediato, sin un destello de claridad', async () => {
  const { fundido, interfaz } = crearFundido();
  fundido.dejar('cerrar');
  expect(fundido.estaOscura).toBe(true);

  await fundido.fundir('cerrar', 2, SIN_CORTAR);

  expect(interfaz.opacidadDelFundido).toBe(1);
});

test('si el fundido se corta, termina en ese momento y no deja nada pendiente en el reloj', async () => {
  const { fundido, interfaz, reloj } = crearFundido();
  const cancelador = new AbortController();
  let termino = false;

  void fundido.fundir('cerrar', 2, cancelador.signal).then(() => {
    termino = true;
  });
  await reloj.avanzar(1);
  cancelador.abort();
  await reloj.avanzar(1);

  expect(termino).toBe(true);
  expect(interfaz.opacidadDelFundido).toBe(0.5);
});
