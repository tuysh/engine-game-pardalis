import { expect, test } from 'bun:test';
import { debeCaminarParaSeguir } from './seguir.ts';

const JUGADOR = { x: 5, y: 2 };

test('quien sigue se queda quieto mientras el otro está cerca', () => {
  expect(debeCaminarParaSeguir({ x: 4, y: 2 }, JUGADOR, false)).toBe(false);
});

test('empieza a caminar cuando el otro se aleja más de metro y medio', () => {
  expect(debeCaminarParaSeguir({ x: 3, y: 2 }, JUGADOR, false)).toBe(true);
});

test('una vez caminando, sigue hasta quedar a menos de un metro: no se detiene en cuanto empieza', () => {
  expect(debeCaminarParaSeguir({ x: 3.8, y: 2 }, JUGADOR, true)).toBe(true);
  expect(debeCaminarParaSeguir({ x: 4.2, y: 2 }, JUGADOR, true)).toBe(false);
});
