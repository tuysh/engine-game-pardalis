import { expect, test } from 'bun:test';
import { crearDiagnostico } from '../../dominio/diagnostico.ts';
import type { Diagnostico } from '../../dominio/diagnostico.ts';
import type { Mundo } from '../../dominio/mundo.ts';
import { LectorDeMapasDeTiled } from './lector-de-mapas-de-tiled.ts';

/** Un mapa de Tiled de 1000 × 600 píxeles con esas capas. Las pruebas usan 100 píxeles por metro. */
function mapaCon(capas: unknown[]): unknown {
  return { width: 10, height: 6, tilewidth: 100, tileheight: 100, layers: capas };
}

function capaDeObjetos(nombre: string, objetos: unknown[]): unknown {
  return { name: nombre, type: 'objectgroup', objects: objetos };
}

function propiedades(valores: Record<string, unknown>): unknown[] {
  return Object.keys(valores).map((nombre) => ({ name: nombre, value: valores[nombre] }));
}

/** Lee el mapa y devuelve el mundo junto con lo que se anotó. */
function leer(mapa: unknown): { mundo: Mundo | undefined; diagnostico: Diagnostico } {
  const diagnostico = crearDiagnostico();
  const mundo = new LectorDeMapasDeTiled().leerMundo(mapa, 100, diagnostico);
  return { mundo, diagnostico };
}

test('el tamaño del mapa se convierte de celdas a metros', () => {
  const { mundo, diagnostico } = leer(mapaCon([]));

  expect(mundo?.anchoEnMetros).toBe(10);
  expect(mundo?.profundidadEnMetros).toBe(6);
  expect(diagnostico).toEqual({ errores: [], advertencias: [] });
});

test('algo que no es un mapa de Tiled se reporta y no da mundo', () => {
  const { mundo, diagnostico } = leer({ hola: 'mundo' });

  expect(mundo).toBeUndefined();
  expect(diagnostico.errores).toEqual([
    'mapa: el archivo no es un mapa de Tiled en formato JSON: le falta la lista "layers"; ' +
      'en Tiled, guárdalo con «Guardar como» y el formato .tmj',
  ]);
});

test('la capa "suelo" da la imagen del piso y dónde va su esquina', () => {
  const suelo = { name: 'suelo', type: 'imagelayer', offsetx: 50, offsety: 100, properties: propiedades({ asset: 'suelo_barrio' }) };

  const { mundo } = leer(mapaCon([suelo]));

  expect(mundo?.suelo).toEqual({ asset: 'suelo_barrio', esquina: { x: 0.5, y: 1 } });
});

test('un telón es una línea de dos puntos con asset y alto', () => {
  const linea = {
    id: 3,
    x: 100,
    y: 200,
    polyline: [{ x: 0, y: 0 }, { x: 800, y: 0 }],
    properties: propiedades({ asset: 'telon_fachadas', alto: 450 }),
  };

  const { mundo } = leer(mapaCon([capaDeObjetos('telones', [linea])]));

  expect(mundo?.telones).toEqual([
    { descripcion: 'objeto #3', asset: 'telon_fachadas', desde: { x: 1, y: 2 }, hasta: { x: 9, y: 2 }, altoEnMetros: 4.5 },
  ]);
});

test('un objeto de decorado es su huella, con una clase del catálogo y su imagen', () => {
  const puesto = { id: 5, name: 'Tortillería', type: 'parado', x: 300, y: 200, width: 320, height: 90, properties: propiedades({ asset: 'puesto', id: 'puesto_tortu' }) };
  const papelPicado = { id: 6, type: 'colgado', x: 0, y: 300, width: 600, height: 10, properties: propiedades({ asset: 'papel_picado', altura: 260 }) };

  const { mundo, diagnostico } = leer(mapaCon([capaDeObjetos('decorado', [puesto, papelPicado])]));

  expect(diagnostico.errores).toEqual([]);
  expect(mundo?.decorado).toEqual([
    {
      descripcion: 'objeto #5 "Tortillería"',
      clase: 'parado',
      asset: 'puesto',
      huella: { x: 3, y: 2, ancho: 3.2, alto: 0.9 },
      alturaEnMetros: 2.2,
      id: 'puesto_tortu',
    },
    {
      descripcion: 'objeto #6',
      clase: 'colgado',
      asset: 'papel_picado',
      huella: { x: 0, y: 3, ancho: 6, alto: 0.1 },
      alturaEnMetros: 2.6,
      id: undefined,
    },
  ]);
});

test('la clase de Tiled 1.9 (campo "class") también se entiende', () => {
  const tapete = { id: 7, class: 'plano', x: 0, y: 0, width: 100, height: 100, properties: propiedades({ asset: 'tapete' }) };

  const { mundo } = leer(mapaCon([capaDeObjetos('decorado', [tapete])]));

  expect(mundo?.decorado[0]?.clase).toBe('plano');
});

test('los NPCs quedan por id, con su posición y hacia dónde miran', () => {
  const tortu = { id: 8, name: 'Doña Tortu', point: true, x: 550, y: 330, properties: propiedades({ id: 'tortu', mira: 'izquierda' }) };
  const gato = { id: 9, x: 100, y: 100, width: 40, height: 20, properties: propiedades({ id: 'gato' }) };

  const { mundo } = leer(mapaCon([capaDeObjetos('npcs', [tortu, gato])]));

  expect(mundo?.npcs).toEqual({
    tortu: { descripcion: 'objeto #8 "Doña Tortu"', posicion: { x: 5.5, y: 3.3 }, mira: 'izquierda' },
    // Un NPC dibujado como rectángulo se para en su centro, y sin "mira" mira a la derecha.
    gato: { descripcion: 'objeto #9', posicion: { x: 1.2, y: 1.1 }, mira: 'derecha' },
  });
});

test('la capa "interaccion" da el inicio del jugador, los puntos, la salida y las zonas', () => {
  const objetos = [
    { id: 10, type: 'inicioJugador', point: true, x: 200, y: 400, properties: propiedades({ mira: 'derecha' }) },
    { id: 11, name: 'frente_tortilleria', type: 'punto', point: true, x: 480, y: 380 },
    { id: 12, type: 'salida', x: 900, y: 300, width: 100, height: 200 },
    { id: 13, name: 'entrada', type: 'zona', x: 100, y: 300, width: 300, height: 200, properties: propiedades({ grupo: 'general', espera: 5 }) },
    { id: 14, name: 'plaza', type: 'zona', x: 500, y: 300, polygon: [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 100 }] },
  ];

  const { mundo, diagnostico } = leer(mapaCon([capaDeObjetos('interaccion', objetos)]));

  expect(diagnostico.errores).toEqual([]);
  expect(mundo?.iniciosDelJugador).toEqual([{ descripcion: 'objeto #10', posicion: { x: 2, y: 4 }, mira: 'derecha' }]);
  expect(mundo?.puntos).toEqual({ frente_tortilleria: { x: 4.8, y: 3.8 } });
  expect(mundo?.salida).toEqual({
    descripcion: 'objeto #12',
    forma: { tipo: 'rectangulo', rectangulo: { x: 9, y: 3, ancho: 1, alto: 2 } },
  });
  expect(mundo?.zonas).toEqual({
    entrada: {
      descripcion: 'objeto #13 "entrada"',
      forma: { tipo: 'rectangulo', rectangulo: { x: 1, y: 3, ancho: 3, alto: 2 } },
      grupo: 'general',
      esperaEnSegundos: 5,
    },
    plaza: {
      descripcion: 'objeto #14 "plaza"',
      forma: { tipo: 'poligono', vertices: [{ x: 5, y: 3 }, { x: 6, y: 3 }, { x: 5.5, y: 4 }] },
      grupo: undefined,
      esperaEnSegundos: 20,
    },
  });
});

test('el piso acepta polígonos y rectángulos', () => {
  const poligono = { id: 15, x: 100, y: 100, polygon: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 100, y: 100 }] };
  const rectangulo = { id: 16, x: 0, y: 300, width: 1000, height: 200 };

  const { mundo } = leer(mapaCon([capaDeObjetos('piso', [poligono, rectangulo])]));

  expect(mundo?.pisos).toEqual([
    [{ x: 1, y: 1 }, { x: 3, y: 1 }, { x: 2, y: 2 }],
    [{ x: 0, y: 3 }, { x: 10, y: 3 }, { x: 10, y: 5 }, { x: 0, y: 5 }],
  ]);
});

test('los objetos mal dibujados se reportan con su número, su nombre y su capa', () => {
  const capas = [
    capaDeObjetos('telones', [{ id: 1, x: 0, y: 0, width: 10, height: 10, properties: propiedades({ asset: 'a', alto: 100 }) }]),
    capaDeObjetos('decorado', [
      { id: 2, name: 'Puesto', type: 'puesto', x: 0, y: 0, width: 10, height: 10, properties: propiedades({ asset: 'a' }) },
      { id: 3, type: 'parado', x: 0, y: 0, width: 10, height: 10 },
      { id: 4, type: 'parado', point: true, x: 0, y: 0, properties: propiedades({ asset: 'a' }) },
    ]),
    capaDeObjetos('npcs', [
      { id: 5, point: true, x: 0, y: 0 },
      { id: 6, point: true, x: 0, y: 0, properties: propiedades({ id: 'tortu', mira: 'arriba' }) },
      { id: 7, point: true, x: 0, y: 0, properties: propiedades({ id: 'tortu' }) },
    ]),
    capaDeObjetos('interaccion', [
      { id: 8, type: 'punto', point: true, x: 0, y: 0 },
      { id: 9, type: 'puerta', point: true, x: 0, y: 0 },
      { id: 10, type: 'salida', x: 0, y: 0, width: 10, height: 10 },
      { id: 11, type: 'salida', x: 0, y: 0, width: 10, height: 10 },
      { id: 12, name: 'plaza', type: 'zona', point: true, x: 0, y: 0 },
    ]),
    capaDeObjetos('piso', [{ id: 13, point: true, x: 0, y: 0 }]),
  ];

  const { diagnostico } = leer(mapaCon(capas));

  expect(diagnostico.errores).toEqual([
    'mapa: objeto #1 de la capa "telones": un telón se dibuja como una línea de dos puntos',
    'mapa: objeto #2 "Puesto" de la capa "decorado": la clase "puesto" no existe; las clases de decorado son: parado, plano, colgado',
    'mapa: objeto #3 de la capa "decorado": falta la propiedad "asset" con la clave de su imagen',
    'mapa: objeto #4 de la capa "decorado": debe ser un rectángulo: su forma es la huella del objeto en el piso',
    'mapa: objeto #5 de la capa "npcs": falta la propiedad "id" con el id de su personaje',
    'mapa: objeto #6 de la capa "npcs": la propiedad "mira" debe ser "izquierda" o "derecha"',
    'mapa: objeto #7 de la capa "npcs": ya hay otro NPC con el id "tortu"',
    'mapa: objeto #8 de la capa "interaccion": un punto necesita nombre: es como lo usan los pasos "camina"',
    'mapa: objeto #9 de la capa "interaccion": la clase "puerta" no existe; las clases de esta capa son: inicioJugador, punto, salida, zona',
    'mapa: objeto #11 de la capa "interaccion": solo puede haber una salida en el mapa',
    'mapa: objeto #12 "plaza" de la capa "interaccion": una zona se dibuja como un rectángulo o un polígono',
    'mapa: objeto #13 de la capa "piso": el piso se dibuja con polígonos de 3 o más vértices, o con rectángulos',
  ]);
});

test('una capa que el motor no usa da advertencia, salvo que se marque para ignorar', () => {
  const notas = { name: 'notas', type: 'objectgroup', objects: [] };
  const bocetos = { name: 'bocetos', type: 'imagelayer', properties: propiedades({ ignorar: true }) };

  const { diagnostico } = leer(mapaCon([notas, bocetos]));

  expect(diagnostico.errores).toEqual([]);
  expect(diagnostico.advertencias).toEqual([
    'mapa: la capa "notas" no es una de las que usa el motor (suelo, telones, decorado, npcs, interaccion, piso) ' +
      'y se ignora; si es a propósito, ponle la propiedad booleana "ignorar" marcada',
  ]);
});

test('una capa con el tipo equivocado se reporta', () => {
  const sueloComoObjetos = capaDeObjetos('suelo', []);
  const pisoComoImagen = { name: 'piso', type: 'imagelayer' };

  const { diagnostico } = leer(mapaCon([sueloComoObjetos, pisoComoImagen]));

  expect(diagnostico.errores).toEqual([
    'mapa: la capa "suelo" debe ser una capa de imagen',
    'mapa: la capa "piso" debe ser una capa de objetos',
  ]);
});

test('la propiedad "visibleCuando" de un objeto de decorado se lee como una condición', () => {
  const letrero = { id: 9, type: 'colgado', x: 0, y: 300, width: 100, height: 10, properties: propiedades({ asset: 'letrero', visibleCuando: 'no tengo verduras' }) };

  const { mundo, diagnostico } = leer(mapaCon([capaDeObjetos('decorado', [letrero])]));

  expect(diagnostico.errores).toEqual([]);
  expect(mundo?.decorado[0]?.visibleCuando).toEqual({ tipo: 'no', condicion: { tipo: 'variable', nombre: 'verduras' } });
});
