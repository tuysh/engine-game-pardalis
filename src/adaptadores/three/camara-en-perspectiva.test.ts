// Pruebas de la cámara: en una pantalla más angosta que 16:9 abre su ángulo vertical para que los planos
// sigan viendo lo mismo de ancho (una tableta 4:3 no corta a nadie por la orilla).
// No hace falta dibujar nada: Three.js calcula la proyección sin pantalla.

import { expect, test } from 'bun:test';
import { Vector3 } from 'three';
import { calcularAnguloDeVisionVertical, CamaraEnPerspectiva } from './camara-en-perspectiva.ts';

const DIECISEIS_NOVENOS = 16 / 9;
const CUATRO_TERCIOS = 4 / 3;
const GRADOS_POR_MEDIA_VUELTA = 180;

/** La mitad del ancho que se ve a un metro de la cámara, para un ángulo vertical y una proporción. */
function mitadDelAnchoVisibleAUnMetro(anguloVerticalEnGrados: number, anchoEntreAlto: number): number {
  const mitadEnRadianes = (anguloVerticalEnGrados * Math.PI) / GRADOS_POR_MEDIA_VUELTA / 2;
  return Math.tan(mitadEnRadianes) * anchoEntreAlto;
}

test('en 16:9 y en pantallas más anchas, el ángulo vertical es el de siempre: 35°', () => {
  expect(calcularAnguloDeVisionVertical(DIECISEIS_NOVENOS)).toBe(35);
  expect(calcularAnguloDeVisionVertical(21 / 9)).toBe(35);
});

test('en 4:3 el ángulo vertical se abre para ver el mismo ancho que en 16:9', () => {
  const anguloEn4Entre3 = calcularAnguloDeVisionVertical(CUATRO_TERCIOS);

  expect(anguloEn4Entre3).toBeGreaterThan(35);
  expect(mitadDelAnchoVisibleAUnMetro(anguloEn4Entre3, CUATRO_TERCIOS)).toBeCloseTo(
    mitadDelAnchoVisibleAUnMetro(35, DIECISEIS_NOVENOS),
    6,
  );
});

test('en un teléfono de pie el ángulo no pasa de 60°, para que nada se vea diminuto ni deformado', () => {
  expect(calcularAnguloDeVisionVertical(9 / 16)).toBe(60);
});

test('un personaje en la orilla de un plano de 16:9 sigue dentro de la pantalla en 4:3', () => {
  const camara = new CamaraEnPerspectiva();
  camara.colocar({ x: 0, y: 0 }, { distanciaEnMetros: 10, alturaEnMetros: 2, giroEnGrados: 0 });
  camara.cambiarProporcion(DIECISEIS_NOVENOS);
  camara.camara.updateMatrixWorld();
  // Un punto casi en la orilla izquierda del plano de 16:9 (en la pantalla, x = -1 es la orilla).
  const enLaOrilla = new Vector3(-0.95, 0, 0).unproject(camara.camara);
  const direccion = enLaOrilla.sub(camara.camara.position).normalize();
  const personaje = camara.camara.position.clone().add(direccion.multiplyScalar(10));

  camara.cambiarProporcion(CUATRO_TERCIOS);
  const enPantalla = personaje.clone().project(camara.camara);

  expect(enPantalla.x).toBeCloseTo(-0.95, 6);
});
