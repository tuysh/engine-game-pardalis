import { expect, test } from 'bun:test';
import { mezclarEncuadres, perseguirEncuadre, suavizarAvance } from './encuadre.ts';
import type { Encuadre } from './encuadre.ts';

const DE_LEJOS: Encuadre = {
  punto: { x: 0, y: 0 },
  ajustes: { distanciaEnMetros: 8, alturaEnMetros: 4, giroEnGrados: 0 },
};
const DE_CERCA: Encuadre = {
  punto: { x: 10, y: 2 },
  ajustes: { distanciaEnMetros: 4, alturaEnMetros: 2, giroEnGrados: 20 },
};

test('con avance 0 el encuadre es el de salida y con avance 1 es el de llegada', () => {
  expect(mezclarEncuadres(DE_LEJOS, DE_CERCA, 0)).toEqual(DE_LEJOS);
  expect(mezclarEncuadres(DE_LEJOS, DE_CERCA, 1)).toEqual(DE_CERCA);
});

test('a medio camino, cada medida queda a la mitad', () => {
  expect(mezclarEncuadres(DE_LEJOS, DE_CERCA, 0.5)).toEqual({
    punto: { x: 5, y: 1 },
    ajustes: { distanciaEnMetros: 6, alturaEnMetros: 3, giroEnGrados: 10 },
  });
});

test('el avance suavizado empieza en 0, termina en 1 y pasa por la mitad a medio camino', () => {
  expect(suavizarAvance(0)).toBe(0);
  expect(suavizarAvance(0.5)).toBe(0.5);
  expect(suavizarAvance(1)).toBe(1);
});

test('el avance suavizado arranca despacio y frena al llegar', () => {
  expect(suavizarAvance(0.1)).toBeLessThan(0.1);
  expect(suavizarAvance(0.9)).toBeGreaterThan(0.9);
});

test('un avance fuera de 0 a 1 se queda en el extremo', () => {
  expect(suavizarAvance(-2)).toBe(0);
  expect(suavizarAvance(3)).toBe(1);
});

test('una cámara que persigue se acerca a lo que sigue sin alcanzarlo de golpe', () => {
  const trasUnCuadro = perseguirEncuadre(DE_LEJOS, DE_CERCA, 0.1);

  expect(trasUnCuadro.punto.x).toBeGreaterThan(0);
  expect(trasUnCuadro.punto.x).toBeLessThan(10);
});

test('persiguiendo el tiempo suficiente, la cámara llega a lo que sigue', () => {
  const trasMuchoTiempo = perseguirEncuadre(DE_LEJOS, DE_CERCA, 60);

  expect(trasMuchoTiempo.punto.x).toBeCloseTo(10);
  expect(trasMuchoTiempo.ajustes.distanciaEnMetros).toBeCloseTo(4);
});

test('perseguir da el mismo resultado en un cuadro largo que en dos cortos', () => {
  const enUnCuadro = perseguirEncuadre(DE_LEJOS, DE_CERCA, 0.2);
  const enDosCuadros = perseguirEncuadre(perseguirEncuadre(DE_LEJOS, DE_CERCA, 0.1), DE_CERCA, 0.1);

  expect(enDosCuadros.punto.x).toBeCloseTo(enUnCuadro.punto.x);
});
