import { expect, test } from 'bun:test';
import { lugarParaHablarCon, lugarParaUsar } from './lugar-para-hablar.ts';

test('el jugador se para junto al personaje, del lado en que ya estaba y un pasito al frente', () => {
  const posicionDeTortu = { x: 5, y: 2 };

  expect(lugarParaHablarCon(posicionDeTortu, { x: 1, y: 3 })).toEqual({ x: 4.1, y: 2.1 });
  expect(lugarParaHablarCon(posicionDeTortu, { x: 9, y: 3 })).toEqual({ x: 5.9, y: 2.1 });
});

test('si el jugador está justo enfrente, se para a la derecha', () => {
  expect(lugarParaHablarCon({ x: 5, y: 2 }, { x: 5, y: 4 })).toEqual({ x: 5.9, y: 2.1 });
});

test('para usar un objeto, el jugador se para frente a su huella y centrado', () => {
  const huellaDelComal = { x: 6, y: 2, ancho: 1, alto: 0.5 };

  expect(lugarParaUsar(huellaDelComal)).toEqual({ x: 6.5, y: 2.8 });
});
