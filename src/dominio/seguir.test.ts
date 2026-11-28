import { expect, test } from 'bun:test';
import { distanciaEntre } from './geometria.ts';
import { debeEmpezarASeguir, lugarParaSeguir, tapaAlOtro } from './seguir.ts';
import type { Terreno } from './terreno.ts';

const JUGADOR = { x: 5, y: 2 };

/** Un cuarto de 10 × 4 metros sin nada que estorbe. */
const CUARTO: Terreno = {
  pisos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }]],
  obstaculos: [],
};

test('quien sigue se queda quieto mientras el otro está cerca', () => {
  expect(debeEmpezarASeguir({ x: 4, y: 2 }, JUGADOR, 0.9)).toBe(false);
});

test('empieza a caminar cuando el otro se aleja más de su distancia y un poco más', () => {
  expect(debeEmpezarASeguir({ x: 3, y: 2 }, JUGADOR, 0.9)).toBe(true);
  expect(debeEmpezarASeguir({ x: 3, y: 2 }, JUGADOR, 2)).toBe(false);
});

test('aunque esté cerca, empieza a caminar si quedó delante del otro tapándolo', () => {
  expect(tapaAlOtro({ x: 5.2, y: 2.3 }, JUGADOR)).toBe(true);
  expect(debeEmpezarASeguir({ x: 5.2, y: 2.3 }, JUGADOR, 0.9)).toBe(true);
  // Detrás del otro (más lejos de la cámara) no lo tapa: su dibujo queda atrás.
  expect(tapaAlOtro({ x: 5.2, y: 1.7 }, JUGADOR)).toBe(false);
});

test('su lugar está a su distancia, de su lado y un poco atrás del otro', () => {
  const lugar = lugarParaSeguir({ x: 2, y: 2 }, JUGADOR, { distanciaEnMetros: 1, lado: -1 }, CUARTO);

  expect(distanciaEntre(lugar, JUGADOR)).toBeCloseTo(1);
  expect(lugar.x).toBeLessThan(JUGADOR.x);
  expect(lugar.y).toBeLessThan(JUGADOR.y);
});

test('si atrás no se puede pisar, se queda a la misma altura del otro', () => {
  const contraLaPared = { x: 5, y: 0.1 };

  const lugar = lugarParaSeguir({ x: 2, y: 0.1 }, contraLaPared, { distanciaEnMetros: 1, lado: -1 }, CUARTO);

  expect(lugar).toEqual({ x: 4, y: 0.1 });
});
