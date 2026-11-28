import { expect, test } from 'bun:test';
import { numeroGramaticalDe } from './numero-gramatical.ts';

test('un nombre con artículo singular es singular', () => {
  expect(numeroGramaticalDe('el maíz')).toBe('singular');
  expect(numeroGramaticalDe('una piñata')).toBe('singular');
  expect(numeroGramaticalDe('tu mochila')).toBe('singular');
});

test('un nombre con artículo plural es plural, sin importar mayúsculas ni espacios', () => {
  expect(numeroGramaticalDe('las tortillas')).toBe('plural');
  expect(numeroGramaticalDe('  Los   chiles')).toBe('plural');
});

test('un nombre sin artículo no se adivina', () => {
  expect(numeroGramaticalDe('pan')).toBeUndefined();
  expect(numeroGramaticalDe('tortillas')).toBeUndefined();
  expect(numeroGramaticalDe('')).toBeUndefined();
});
