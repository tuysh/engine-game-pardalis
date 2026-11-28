// Pruebas del orden en que se dibujan las hojas de papel: no hace falta pantalla, solo la cámara y las piezas.

import { expect, test } from 'bun:test';
import { Mesh, MeshBasicMaterial, PerspectiveCamera, PlaneGeometry, Texture } from 'three';
import { crearOrdenDeLoTransparente } from './orden-de-lo-transparente.ts';
import { crearHojaParada, ORDEN_DE_LAS_SOMBRAS, ORDEN_DE_LO_PARADO } from './piezas-de-papel.ts';

/** Una cámara como la del juego: 4 metros arriba y 8 atrás, mirando al pecho de quien está en el origen. */
function crearCamara(): PerspectiveCamera {
  const camara = new PerspectiveCamera(35, 1, 0.1, 200);
  camara.position.set(0, 4, 8);
  camara.lookAt(0, 0.9, 0);
  camara.updateMatrixWorld();
  return camara;
}

/** Una hoja parada de ese alto, pisando en `z`, lista para ordenarse como lo haría Three.js. */
function crearPieza(id: number, altoEnMetros: number, z: number) {
  // La prueba no dibuja: una textura sin imagen basta.
  const hoja = crearHojaParada(new Texture(), { anchoEnMetros: 1, altoEnMetros });
  hoja.position.set(0, 0, z);
  hoja.updateMatrixWorld();
  return { groupOrder: 0, renderOrder: hoja.renderOrder, object: hoja, id };
}

test('un árbol alto detrás de alguien bajito se dibuja antes, aunque su centro quede más cerca de la cámara', () => {
  const camara = crearCamara();
  const arbol = crearPieza(1, 3, -0.3);
  const nina = crearPieza(2, 1, 0);
  // El centro del árbol (a 1.5 m de alto) sí está más cerca de esta cámara que el de la niña (a 0.5 m):
  // por eso Three.js, solo, dibujaba el árbol encima.
  expect(camara.position.distanceTo(arbol.object.position.clone().setY(1.5))).toBeLessThan(
    camara.position.distanceTo(nina.object.position.clone().setY(0.5)),
  );

  const ordenadas = [nina, arbol].sort(crearOrdenDeLoTransparente(camara));

  expect(ordenadas.map((pieza) => pieza.id)).toEqual([1, 2]);
});

test('el orden de dibujo manda antes que la profundidad: lo del piso va antes que lo parado', () => {
  const camara = crearCamara();
  const parado = crearPieza(1, 1, -2);
  const sombra = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial());
  sombra.renderOrder = ORDEN_DE_LAS_SOMBRAS;
  sombra.position.set(0, 0, 3);
  sombra.updateMatrixWorld();
  const enElPiso = { groupOrder: 0, renderOrder: sombra.renderOrder, object: sombra, id: 2 };

  const ordenadas = [parado, enElPiso].sort(crearOrdenDeLoTransparente(camara));

  expect(ordenadas.map((pieza) => pieza.renderOrder)).toEqual([ORDEN_DE_LAS_SOMBRAS, ORDEN_DE_LO_PARADO]);
});

test('a la misma profundidad, conservan el orden en que se agregaron', () => {
  const camara = crearCamara();
  const primera = crearPieza(1, 1, 0);
  const segunda = crearPieza(2, 2, 0);

  const ordenadas = [segunda, primera].sort(crearOrdenDeLoTransparente(camara));

  expect(ordenadas.map((pieza) => pieza.id)).toEqual([1, 2]);
});
