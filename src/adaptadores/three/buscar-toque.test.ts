// Pruebas de qué se tocó: la línea imaginaria desde la cámara choca con hojas de papel puestas en fila.
// No hace falta dibujar nada: Three.js calcula los choques sin pantalla.

import { expect, test } from 'bun:test';
import { Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry } from 'three';
import type { Object3D } from 'three';
import type { Toque } from '../../puertos/escenario.ts';
import { buscarToque } from './buscar-toque.ts';

/** El centro de un lienzo de 100 × 100: la línea sale derecho hacia donde mira la cámara. */
const CENTRO_DEL_LIENZO = { x: 50, y: 50, anchoDelLienzo: 100, altoDelLienzo: 100 };

/** Una cámara a 10 metros, mirando hacia el fondo (hacia `z` negativa), a la altura de 1 metro. */
function crearCamara(): PerspectiveCamera {
  const camara = new PerspectiveCamera(40, 1, 0.1, 100);
  camara.position.set(0, 1, 10);
  camara.lookAt(0, 1, 0);
  camara.updateMatrixWorld();
  return camara;
}

/** Una hoja de papel parada de frente a la cámara, a cierta profundidad. */
function crearHoja(profundidad: number): Mesh {
  const hoja = new Mesh(new PlaneGeometry(1, 2), new MeshBasicMaterial());
  hoja.position.set(0, 1, profundidad);
  hoja.updateMatrixWorld();
  return hoja;
}

test('si el primero es un personaje y detrás hay otro, el toque trae al de atrás', () => {
  const tocables = new Map<Object3D, Toque>([
    [crearHoja(2), { tipo: 'personaje', id: 'bobby' }],
    [crearHoja(-1), { tipo: 'personaje', id: 'tendero' }],
  ]);

  const toque = buscarToque(CENTRO_DEL_LIENZO, crearCamara(), tocables);

  expect(toque).toEqual({ tipo: 'personaje', id: 'bobby', detras: { tipo: 'personaje', id: 'tendero' } });
});

test('si detrás del personaje hay un objeto del decorado, el toque trae el objeto', () => {
  const tocables = new Map<Object3D, Toque>([
    [crearHoja(2), { tipo: 'personaje', id: 'bobby' }],
    [crearHoja(-1), { tipo: 'decorado', id: 'pinata' }],
  ]);

  expect(buscarToque(CENTRO_DEL_LIENZO, crearCamara(), tocables)).toEqual({
    tipo: 'personaje',
    id: 'bobby',
    detras: { tipo: 'decorado', id: 'pinata' },
  });
});

test('un personaje solo, sin nada tocable detrás, no trae nada atrás', () => {
  const tocables = new Map<Object3D, Toque>([[crearHoja(2), { tipo: 'personaje', id: 'bobby' }]]);

  expect(buscarToque(CENTRO_DEL_LIENZO, crearCamara(), tocables)).toEqual({ tipo: 'personaje', id: 'bobby' });
});

test('dos piezas del mismo personaje no cuentan como «otro detrás»', () => {
  const tocables = new Map<Object3D, Toque>([
    [crearHoja(2), { tipo: 'personaje', id: 'bobby' }],
    [crearHoja(1.9), { tipo: 'personaje', id: 'bobby' }],
  ]);

  expect(buscarToque(CENTRO_DEL_LIENZO, crearCamara(), tocables)).toEqual({ tipo: 'personaje', id: 'bobby' });
});

test('si lo primero es un objeto del decorado, el toque es para él, sin nada más', () => {
  const tocables = new Map<Object3D, Toque>([
    [crearHoja(2), { tipo: 'decorado', id: 'pinata' }],
    [crearHoja(-1), { tipo: 'personaje', id: 'tendero' }],
  ]);

  expect(buscarToque(CENTRO_DEL_LIENZO, crearCamara(), tocables)).toEqual({ tipo: 'decorado', id: 'pinata' });
});
