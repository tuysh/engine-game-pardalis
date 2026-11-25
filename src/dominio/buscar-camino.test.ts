import { expect, test } from 'bun:test';
import { buscarCamino, elTramoEstaLibre } from './buscar-camino.ts';
import type { Punto } from './geometria.ts';
import { crearMapaDeCaminos } from './rejilla-de-caminos.ts';
import { esCaminable } from './terreno.ts';
import type { Terreno } from './terreno.ts';

/** Una calle de 10 × 4 metros con un puesto ancho en medio, que deja pasar solo por el frente (y > 3). */
const CALLE_CON_PUESTO: Terreno = {
  pisos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }]],
  obstaculos: [{ x: 4, y: 0, ancho: 2, alto: 3 }],
};
const MAPA = crearMapaDeCaminos(CALLE_CON_PUESTO);

/** Recorre el camino tramo por tramo y dice si todos están libres. */
function todosLosTramosEstanLibres(desde: Punto, puntos: readonly Punto[], terreno: Terreno): boolean {
  let anterior = desde;
  for (const punto of puntos) {
    if (!elTramoEstaLibre(anterior, punto, terreno)) return false;
    anterior = punto;
  }
  return true;
}

test('con el camino recto libre, el camino es un solo tramo hasta el destino', () => {
  const camino = buscarCamino({ x: 1, y: 3.5 }, { x: 9, y: 3.5 }, MAPA);

  expect(camino).toEqual({ puntos: [{ x: 9, y: 3.5 }], llegaAlDestino: true });
});

test('con un obstáculo en medio, el camino lo rodea y termina justo en el destino', () => {
  const desde = { x: 1, y: 1 };
  const hasta = { x: 9, y: 1 };

  const camino = buscarCamino(desde, hasta, MAPA);

  expect(camino?.llegaAlDestino).toBe(true);
  expect(camino?.puntos.at(-1)).toEqual(hasta);
  expect(camino?.puntos.length).toBeGreaterThan(1);
  expect(todosLosTramosEstanLibres(desde, camino?.puntos ?? [], CALLE_CON_PUESTO)).toBe(true);
});

test('el camino enderezado tiene pocos puntos: no va de celda en celda', () => {
  const camino = buscarCamino({ x: 1, y: 1 }, { x: 9, y: 1 }, MAPA);

  expect(camino?.puntos.length).toBeLessThanOrEqual(4);
});

test('si el destino está dentro de un obstáculo, el camino lleva al lugar pisable más cercano', () => {
  const dentroDelPuesto = { x: 5, y: 2.5 };

  const camino = buscarCamino({ x: 1, y: 3.5 }, dentroDelPuesto, MAPA);

  const final = camino?.puntos.at(-1) ?? { x: 0, y: 0 };
  expect(camino?.llegaAlDestino).toBe(false);
  expect(esCaminable(final, CALLE_CON_PUESTO)).toBe(true);
  expect(Math.hypot(final.x - dentroDelPuesto.x, final.y - dentroDelPuesto.y)).toBeLessThan(1);
});

test('si el destino está en un piso aparte, sin paso entre los dos, no se llega', () => {
  const dosPisos: Terreno = {
    pisos: [
      [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 2, y: 2 }, { x: 0, y: 2 }],
      [{ x: 5, y: 0 }, { x: 7, y: 0 }, { x: 7, y: 2 }, { x: 5, y: 2 }],
    ],
    obstaculos: [],
  };

  const camino = buscarCamino({ x: 1, y: 1 }, { x: 6, y: 1 }, crearMapaDeCaminos(dosPisos));

  expect(camino?.llegaAlDestino).toBe(false);
});

test('quien está fuera del piso no tiene camino que buscar', () => {
  expect(buscarCamino({ x: -5, y: 1 }, { x: 9, y: 1 }, MAPA)).toBeUndefined();
});

test('un tramo está libre solo si no cruza un obstáculo ni sale del piso', () => {
  expect(elTramoEstaLibre({ x: 1, y: 3.5 }, { x: 9, y: 3.5 }, CALLE_CON_PUESTO)).toBe(true);
  expect(elTramoEstaLibre({ x: 1, y: 1 }, { x: 9, y: 1 }, CALLE_CON_PUESTO)).toBe(false);
  expect(elTramoEstaLibre({ x: 1, y: 1 }, { x: 1, y: 6 }, CALLE_CON_PUESTO)).toBe(false);
});
