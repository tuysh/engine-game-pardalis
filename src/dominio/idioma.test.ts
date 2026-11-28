import { expect, test } from 'bun:test';
import { otroIdioma } from './idioma.ts';

test('la traducción de algo en español está en inglés, y al revés', () => {
  expect(otroIdioma('es')).toBe('en');
  expect(otroIdioma('en')).toBe('es');
});
