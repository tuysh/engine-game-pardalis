import { expect, test } from 'bun:test';
import type { Plano } from './contenido.ts';
import { alejarPlano, girarPlano } from './encuadrar-plano.ts';

const PLANO: Plano = { mira: 'tortu', distanciaEnMetros: 8, alturaEnMetros: 4, giroEnGrados: 0 };

test('arrastrar hacia la derecha gira la cámara hacia la izquierda, como si se empujara el escenario', () => {
  const plano = girarPlano(PLANO, { haciaLaDerechaEnPuntos: 100, haciaAbajoEnPuntos: 0 });

  expect(plano.giroEnGrados).toBe(-30);
  expect(plano.alturaEnMetros).toBe(4);
});

test('arrastrar hacia abajo sube la cámara, y hacia arriba la baja sin pasar del piso', () => {
  expect(girarPlano(PLANO, { haciaLaDerechaEnPuntos: 0, haciaAbajoEnPuntos: 50 }).alturaEnMetros).toBe(5);
  expect(girarPlano(PLANO, { haciaLaDerechaEnPuntos: 0, haciaAbajoEnPuntos: -10_000 }).alturaEnMetros).toBe(0.2);
});

test('el giro se queda entre -180 y 180 grados aunque se dé la vuelta completa', () => {
  const casiMediaVuelta: Plano = { ...PLANO, giroEnGrados: -170 };

  const plano = girarPlano(casiMediaVuelta, { haciaLaDerechaEnPuntos: 100, haciaAbajoEnPuntos: 0 });

  expect(plano.giroEnGrados).toBe(160);
});

test('la rueda aleja o acerca la cámara, sin atravesar lo que mira ni irse al infinito', () => {
  expect(alejarPlano(PLANO, 1).distanciaEnMetros).toBeCloseTo(8.8);
  expect(alejarPlano(PLANO, -100).distanciaEnMetros).toBe(1);
  expect(alejarPlano(PLANO, 100).distanciaEnMetros).toBe(60);
});

test('encuadrar no cambia a qué mira el plano', () => {
  const plano = alejarPlano(girarPlano(PLANO, { haciaLaDerechaEnPuntos: 40, haciaAbajoEnPuntos: 10 }), 2);

  expect(plano.mira).toBe('tortu');
});
