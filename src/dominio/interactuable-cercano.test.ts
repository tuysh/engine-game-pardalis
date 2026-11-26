import { expect, test } from 'bun:test';
import { buscarInteractuableCercano } from './interactuable-cercano.ts';
import type { Interactuable } from './interactuable-cercano.ts';

const TORTU: Interactuable = { tipo: 'personaje', id: 'tortu', punto: { x: 5, y: 2 } };
const COMAL: Interactuable = { tipo: 'decorado', id: 'comal', punto: { x: 6, y: 2 } };

test('encuentra lo que el jugador tiene a la mano', () => {
  expect(buscarInteractuableCercano({ x: 4, y: 2 }, [TORTU])).toEqual(TORTU);
});

test('de varios, elige el más cercano', () => {
  expect(buscarInteractuableCercano({ x: 5.8, y: 2 }, [TORTU, COMAL])).toEqual(COMAL);
  expect(buscarInteractuableCercano({ x: 5.2, y: 2 }, [TORTU, COMAL])).toEqual(TORTU);
});

test('lo que está a más de 1.8 metros no está a la mano', () => {
  expect(buscarInteractuableCercano({ x: 3.1, y: 2 }, [TORTU])).toBeUndefined();
  expect(buscarInteractuableCercano({ x: 3.2, y: 2 }, [TORTU])).toEqual(TORTU);
});

test('sin nada con qué interactuar, no encuentra nada', () => {
  expect(buscarInteractuableCercano({ x: 0, y: 0 }, [])).toBeUndefined();
});

const PRIMO: Interactuable = { tipo: 'personaje', id: 'bobby', punto: { x: 4.5, y: 2 } };

test('el acompañante cede: aunque esté más cerca, gana otra cosa que esté a la mano', () => {
  expect(buscarInteractuableCercano({ x: 4, y: 2 }, [PRIMO, TORTU], 'bobby')).toEqual(TORTU);
});

test('el acompañante cuenta si no hay nada más a la mano', () => {
  expect(buscarInteractuableCercano({ x: 4, y: 2 }, [PRIMO], 'bobby')).toEqual(PRIMO);
  // Tortu está a más de 1.8 metros: no está a la mano, así que queda el primo.
  expect(buscarInteractuableCercano({ x: 2.9, y: 2 }, [PRIMO, TORTU], 'bobby')).toEqual(PRIMO);
});

test('sin acompañante, gana el más cercano como siempre', () => {
  expect(buscarInteractuableCercano({ x: 4, y: 2 }, [PRIMO, TORTU])).toEqual(PRIMO);
});
