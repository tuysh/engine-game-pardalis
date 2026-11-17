import { expect, test } from 'bun:test';
import { avanzarHacia } from './caminar.ts';
import type { Punto } from './geometria.ts';
import { ajustarAlPiso, crearTerreno, esCaminable } from './terreno.ts';
import type { Terreno } from './terreno.ts';

/** Una calle de 10 × 4 metros con una caja de 1 × 1 en medio. */
const TERRENO: Terreno = {
  pisos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }]],
  obstaculos: [{ x: 4.5, y: 1.5, ancho: 1, alto: 1 }],
};

/** Camina pasito a pasito hasta llegar o atorarse, y devuelve dónde quedó. */
function caminarHasta(inicio: Punto, destino: Punto, terreno: Terreno): { posicion: Punto; llego: boolean } {
  let posicion = inicio;
  for (let cuadro = 0; cuadro < 2000; cuadro++) {
    const avance = avanzarHacia(posicion, destino, 0.05, terreno);
    posicion = avance.posicion;
    if (avance.llego) return { posicion, llego: true };
    if (avance.seAtoro) return { posicion, llego: false };
  }
  return { posicion, llego: false };
}

test('se puede pisar dentro del piso y fuera de los obstáculos', () => {
  expect(esCaminable({ x: 1, y: 1 }, TERRENO)).toBe(true);
  expect(esCaminable({ x: 5, y: 2 }, TERRENO)).toBe(false); // dentro de la caja
  expect(esCaminable({ x: 11, y: 1 }, TERRENO)).toBe(false); // fuera de la calle
});

test('un pasito recto avanza la distancia pedida hacia el destino', () => {
  const avance = avanzarHacia({ x: 1, y: 1 }, { x: 3, y: 1 }, 0.5, TERRENO);

  expect(avance).toEqual({ posicion: { x: 1.5, y: 1 }, llego: false, seAtoro: false });
});

test('el último pasito no se pasa del destino', () => {
  const avance = avanzarHacia({ x: 2.9, y: 1 }, { x: 3, y: 1 }, 0.5, TERRENO);

  expect(avance).toEqual({ posicion: { x: 3, y: 1 }, llego: true, seAtoro: false });
});

test('quien ya está en el destino no se mueve', () => {
  const avance = avanzarHacia({ x: 3, y: 1 }, { x: 3, y: 1 }, 0.5, TERRENO);

  expect(avance).toEqual({ posicion: { x: 3, y: 1 }, llego: true, seAtoro: false });
});

test('caminando paso a paso por un camino libre se llega al destino', () => {
  const resultado = caminarHasta({ x: 1, y: 3.5 }, { x: 9, y: 3 }, TERRENO);

  expect(resultado.llego).toBe(true);
  expect(resultado.posicion).toEqual({ x: 9, y: 3 });
});

test('al chocar en diagonal con una caja, se desliza por su orilla y sigue', () => {
  // De abajo a la izquierda hacia arriba a la derecha: la línea recta pasa por la esquina de la caja.
  const resultado = caminarHasta({ x: 3.5, y: 3.2 }, { x: 6.5, y: 0.6 }, TERRENO);

  expect(resultado.llego).toBe(true);
});

test('de frente contra una caja, se atora justo antes de ella', () => {
  const resultado = caminarHasta({ x: 3, y: 2 }, { x: 7, y: 2 }, TERRENO);

  expect(resultado.llego).toBe(false);
  expect(resultado.posicion.x).toBeLessThan(4.5);
  expect(resultado.posicion.x).toBeGreaterThan(4.4);
});

test('nunca sale del piso aunque el destino esté afuera', () => {
  const resultado = caminarHasta({ x: 9, y: 2 }, { x: 12, y: 2 }, TERRENO);

  expect(resultado.llego).toBe(false);
  expect(resultado.posicion.x).toBeLessThanOrEqual(10);
});

test('un toque fuera del piso se ajusta al punto más cercano de la orilla, por dentro', () => {
  const ajustado = ajustarAlPiso({ x: 5, y: -3 }, TERRENO);

  expect(ajustado.x).toBeCloseTo(5, 1);
  expect(ajustado.y).toBeGreaterThan(0);
  expect(ajustado.y).toBeLessThan(0.05);
  expect(esCaminable(ajustado, TERRENO)).toBe(true);
});

test('un toque fuera del piso cerca de una esquina se ajusta a esa esquina', () => {
  const ajustado = ajustarAlPiso({ x: 13, y: 7 }, TERRENO);

  expect(ajustado.x).toBeCloseTo(10, 1);
  expect(ajustado.y).toBeCloseTo(4, 1);
  expect(esCaminable(ajustado, TERRENO)).toBe(true);
});

test('un toque dentro del piso no se ajusta', () => {
  expect(ajustarAlPiso({ x: 2, y: 2 }, TERRENO)).toEqual({ x: 2, y: 2 });
});

test('el terreno de un mundo usa como obstáculos solo el decorado parado', () => {
  const terreno = crearTerreno({
    anchoEnMetros: 10,
    profundidadEnMetros: 4,
    telones: [],
    decorado: [
      { descripcion: 'caja', clase: 'parado', asset: 'cajas', huella: { x: 1, y: 1, ancho: 1, alto: 1 }, alturaEnMetros: 0 },
      { descripcion: 'tapete', clase: 'plano', asset: 'tapete', huella: { x: 3, y: 1, ancho: 1, alto: 1 }, alturaEnMetros: 0 },
      { descripcion: 'lámpara', clase: 'colgado', asset: 'lampara', huella: { x: 5, y: 1, ancho: 1, alto: 1 }, alturaEnMetros: 2 },
    ],
    npcs: {},
    iniciosDelJugador: [],
    puntos: {},
    zonas: {},
    pisos: TERRENO.pisos,
  });

  expect(terreno.obstaculos).toEqual([{ x: 1, y: 1, ancho: 1, alto: 1 }]);
});
