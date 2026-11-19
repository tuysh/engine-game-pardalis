import { expect, test } from 'bun:test';
import { describirValor } from './describir-valor.ts';

test('un texto va entre comillas, para distinguir "42" de 42', () => {
  expect(describirValor('casa')).toBe('"casa"');
  expect(describirValor(42)).toBe('42');
});

test('lo que no se puede escribir corto se nombra por lo que es', () => {
  expect(describirValor([1, 2])).toBe('una lista');
  expect(describirValor({ a: 1 })).toBe('un objeto');
  expect(describirValor(() => {})).toBe('una función');
});

test('lo que falta se dice tal cual', () => {
  expect(describirValor(undefined)).toBe('undefined');
  expect(describirValor(null)).toBe('null');
});
