import { expect, test } from 'bun:test';
import { distanciaEntre, puntoDentroDePoligono, puntoDentroDeRectangulo } from './geometria.ts';
import type { Punto } from './geometria.ts';

test('la distancia entre dos puntos es la de la línea recta', () => {
  const distancia = distanciaEntre({ x: 0, y: 0 }, { x: 3, y: 4 });

  expect(distancia).toBe(5);
});

test('la distancia de un punto a sí mismo es cero', () => {
  expect(distanciaEntre({ x: 7, y: -2 }, { x: 7, y: -2 })).toBe(0);
});

test('un punto dentro del rectángulo está dentro; uno fuera, no', () => {
  const rectangulo = { x: 10, y: 20, ancho: 100, alto: 50 };

  expect(puntoDentroDeRectangulo({ x: 50, y: 40 }, rectangulo)).toBe(true);
  expect(puntoDentroDeRectangulo({ x: 5, y: 40 }, rectangulo)).toBe(false);
  expect(puntoDentroDeRectangulo({ x: 50, y: 71 }, rectangulo)).toBe(false);
});

test('el borde del rectángulo cuenta como dentro', () => {
  const rectangulo = { x: 10, y: 20, ancho: 100, alto: 50 };

  expect(puntoDentroDeRectangulo({ x: 10, y: 20 }, rectangulo)).toBe(true);
  expect(puntoDentroDeRectangulo({ x: 110, y: 70 }, rectangulo)).toBe(true);
});

test('un punto dentro de un cuadrado está dentro del polígono; uno fuera, no', () => {
  const cuadrado: Punto[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  expect(puntoDentroDePoligono({ x: 5, y: 5 }, cuadrado)).toBe(true);
  expect(puntoDentroDePoligono({ x: 15, y: 5 }, cuadrado)).toBe(false);
  expect(puntoDentroDePoligono({ x: 5, y: -1 }, cuadrado)).toBe(false);
});

test('en un piso con forma de L, el hueco de la L queda fuera', () => {
  // Una sala en L: ocupa toda la franja de abajo y solo la mitad izquierda de arriba.
  const pisoEnL: Punto[] = [
    { x: 0, y: 0 },
    { x: 5, y: 0 },
    { x: 5, y: 5 },
    { x: 10, y: 5 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];

  expect(puntoDentroDePoligono({ x: 2, y: 2 }, pisoEnL)).toBe(true);
  expect(puntoDentroDePoligono({ x: 8, y: 8 }, pisoEnL)).toBe(true);
  expect(puntoDentroDePoligono({ x: 8, y: 2 }, pisoEnL)).toBe(false);
});

test('el resultado no depende del sentido en que se listan los vértices', () => {
  const triangulo: Punto[] = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 5, y: 10 },
  ];
  const trianguloAlReves = [...triangulo].reverse();

  expect(puntoDentroDePoligono({ x: 5, y: 3 }, triangulo)).toBe(true);
  expect(puntoDentroDePoligono({ x: 5, y: 3 }, trianguloAlReves)).toBe(true);
  expect(puntoDentroDePoligono({ x: 1, y: 9 }, trianguloAlReves)).toBe(false);
});

test('una lista sin vértices no contiene ningún punto', () => {
  expect(puntoDentroDePoligono({ x: 0, y: 0 }, [])).toBe(false);
});
