// Pruebas de a quién le toca un toque cuando el acompañante tapa lo que el jugador quería tocar.

import { expect, test } from 'bun:test';
import { elegirLoQueSeQuisoTocar } from './atender-toque.ts';

const TOQUE_AL_PRIMO_CON_EL_TENDERO_DETRAS = {
  tipo: 'personaje',
  id: 'bobby',
  detras: { tipo: 'personaje', id: 'tendero' },
} as const;

test('si se toca al acompañante y detrás hay otro personaje, el toque es para el de atrás', () => {
  const elegido = elegirLoQueSeQuisoTocar(TOQUE_AL_PRIMO_CON_EL_TENDERO_DETRAS, 'bobby');

  expect(elegido).toEqual({ tipo: 'personaje', id: 'tendero' });
});

test('si se toca al acompañante y detrás hay un objeto del decorado, el toque es para el objeto', () => {
  const toque = { tipo: 'personaje', id: 'bobby', detras: { tipo: 'decorado', id: 'pinata' } } as const;

  expect(elegirLoQueSeQuisoTocar(toque, 'bobby')).toEqual({ tipo: 'decorado', id: 'pinata' });
});

test('si se toca al acompañante y detrás solo está el piso, sigue siendo un toque al acompañante', () => {
  const toque = { tipo: 'personaje', id: 'bobby' } as const;

  expect(elegirLoQueSeQuisoTocar(toque, 'bobby')).toEqual(toque);
});

test('un personaje que no es el acompañante no cede el toque, aunque tape a otro', () => {
  const elegido = elegirLoQueSeQuisoTocar(TOQUE_AL_PRIMO_CON_EL_TENDERO_DETRAS, 'otro_primo');

  expect(elegido).toEqual(TOQUE_AL_PRIMO_CON_EL_TENDERO_DETRAS);
});

test('sin acompañante, nadie cede el toque', () => {
  expect(elegirLoQueSeQuisoTocar(TOQUE_AL_PRIMO_CON_EL_TENDERO_DETRAS, undefined)).toEqual(TOQUE_AL_PRIMO_CON_EL_TENDERO_DETRAS);
});

test('los toques al piso y al decorado pasan tal cual', () => {
  const alPiso = { tipo: 'piso', punto: { x: 1, y: 2 } } as const;
  const alDecorado = { tipo: 'decorado', id: 'pinata' } as const;

  expect(elegirLoQueSeQuisoTocar(alPiso, 'bobby')).toEqual(alPiso);
  expect(elegirLoQueSeQuisoTocar(alDecorado, 'bobby')).toEqual(alDecorado);
});
