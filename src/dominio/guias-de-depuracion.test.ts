import { expect, test } from 'bun:test';
import { crearGuiasDelMundo } from './guias-de-depuracion.ts';
import type { Mundo } from './mundo.ts';

const MUNDO: Mundo = {
  anchoEnMetros: 10,
  profundidadEnMetros: 6,
  telones: [],
  decorado: [
    { descripcion: 'comal', clase: 'parado', asset: 'comal', huella: { x: 6, y: 2, ancho: 1, alto: 0.5 }, alturaEnMetros: 0, id: 'comal' },
    { descripcion: 'tapete', clase: 'plano', asset: 'tapete', huella: { x: 1, y: 1, ancho: 2, alto: 1 }, alturaEnMetros: 0 },
  ],
  npcs: {},
  iniciosDelJugador: [{ descripcion: 'inicio', posicion: { x: 2, y: 3 }, mira: 'derecha' }],
  puntos: { frente: { x: 5, y: 3 } },
  salida: { descripcion: 'salida', forma: { tipo: 'rectangulo', rectangulo: { x: 9, y: 2, ancho: 1, alto: 2 } } },
  zonas: {
    plaza: {
      descripcion: 'plaza',
      forma: { tipo: 'poligono', vertices: [{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 2 }] },
      esperaEnSegundos: 20,
    },
  },
  pisos: [[{ x: 0, y: 1 }, { x: 10, y: 1 }, { x: 10, y: 6 }, { x: 0, y: 6 }]],
};

test('hay una guía por cada cosa del mapa que no se ve al jugar', () => {
  const guias = crearGuiasDelMundo(MUNDO);

  const resumen = guias.map((guia) => `${guia.tipo}: ${guia.etiqueta ?? '(sin etiqueta)'}`);
  expect(resumen).toEqual([
    'contorno: (sin etiqueta)',
    'contorno: comal',
    'contorno: (sin etiqueta)',
    'contorno: plaza',
    'contorno: salida',
    'marca: frente',
    'marca: inicioJugador',
  ]);
});

test('la huella de un objeto es un contorno con sus cuatro esquinas', () => {
  const guias = crearGuiasDelMundo(MUNDO);

  expect(guias[1]).toEqual({
    tipo: 'contorno',
    vertices: [
      { x: 6, y: 2 },
      { x: 7, y: 2 },
      { x: 7, y: 2.5 },
      { x: 6, y: 2.5 },
    ],
    color: '#d93025',
    etiqueta: 'comal',
  });
});

test('lo que bloquea el paso se pinta de otro color que lo que no bloquea', () => {
  const guias = crearGuiasDelMundo(MUNDO);

  const huellaDelComal = guias[1];
  const huellaDelTapete = guias[2];
  expect(huellaDelComal?.color).not.toBe(huellaDelTapete?.color);
});
