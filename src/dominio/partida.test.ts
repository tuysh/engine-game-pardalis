import { expect, test } from 'bun:test';
import { actualizarPartida, leerPartida, variablesGuardadasDe } from './partida.ts';
import type { Partida } from './partida.ts';

test('una partida bien formada se lee completa', () => {
  const guardada = {
    v: 1,
    nivel: 'barrio',
    niveles: { casa: { estado: { 'vista.intro': true } }, barrio: { estado: { tortillas: true, dinero: 40 } } },
  };

  const lectura = leerPartida(guardada);

  expect(lectura.advertencia).toBeUndefined();
  expect(lectura.partida).toEqual({
    v: 1,
    nivel: 'barrio',
    niveles: { casa: { estado: { 'vista.intro': true } }, barrio: { estado: { tortillas: true, dinero: 40 } } },
  });
});

test('sin partida no hay nada que leer ni que avisar', () => {
  expect(leerPartida(null)).toEqual({});
  expect(leerPartida(undefined)).toEqual({});
});

test('algo que no es un objeto se ignora con advertencia', () => {
  expect(leerPartida('{"v":1}')).toEqual({ advertencia: 'la partida guardada no es un objeto; se ignora' });
  expect(leerPartida([1, 2])).toEqual({ advertencia: 'la partida guardada no es un objeto; se ignora' });
});

test('una partida de otra versión se ignora con advertencia', () => {
  const partidaDeLaVersionAnterior = { v: 2, nivel: 'tortilleria', estado: { tortillas: true } };

  expect(leerPartida(partidaDeLaVersionAnterior)).toEqual({
    advertencia: 'la partida guardada es de otra versión (v: 2); se ignora',
  });
});

test('una partida sin nivel o sin niveles se ignora con advertencia', () => {
  const advertencia = 'la partida guardada está incompleta (falta "nivel" o "niveles"); se ignora';

  expect(leerPartida({ v: 1, niveles: {} })).toEqual({ advertencia });
  expect(leerPartida({ v: 1, nivel: 'casa' })).toEqual({ advertencia });
  expect(leerPartida({ v: 1, nivel: 'casa', niveles: [] })).toEqual({ advertencia });
});

test('de cada nivel se conservan solo las variables con un valor que el estado puede guardar', () => {
  const guardada = {
    v: 1,
    nivel: 'barrio',
    niveles: {
      barrio: { estado: { tortillas: true, globo: 'rosa', dinero: 40, lista: ['a'], nada: null, infinito: 1e999 } },
    },
  };

  const lectura = leerPartida(guardada);

  expect(lectura.partida?.niveles).toEqual({ barrio: { estado: { tortillas: true, globo: 'rosa', dinero: 40 } } });
});

test('un nivel con forma extraña se descarta sin perder los demás', () => {
  const guardada = { v: 1, nivel: 'barrio', niveles: { casa: 'roto', barrio: { estado: { tortillas: true } } } };

  const lectura = leerPartida(guardada);

  expect(lectura.partida?.niveles).toEqual({ barrio: { estado: { tortillas: true } } });
});

test('un nivel sin estado se conserva con el estado vacío', () => {
  const lectura = leerPartida({ v: 1, nivel: 'casa', niveles: { casa: {} } });

  expect(lectura.partida?.niveles).toEqual({ casa: { estado: {} } });
});

test('ignora la clave __proto__ en los niveles y en las variables', () => {
  const guardada = JSON.parse(
    '{ "v": 1, "nivel": "casa", "niveles": { "__proto__": { "estado": {} }, "casa": { "estado": { "__proto__": true, "a": 1 } } } }',
  );

  const lectura = leerPartida(guardada);

  expect(Object.keys(lectura.partida?.niveles ?? {})).toEqual(['casa']);
  expect(Object.keys(lectura.partida?.niveles.casa?.estado ?? {})).toEqual(['a']);
});

test('actualizar una partida pone las variables del nivel actual y conserva los demás niveles', () => {
  const anterior: Partida = { v: 1, nivel: 'casa', niveles: { casa: { estado: { 'vista.intro': true } } } };

  const partida = actualizarPartida(anterior, 'barrio', { tortillas: true });

  expect(partida).toEqual({
    v: 1,
    nivel: 'barrio',
    niveles: { casa: { estado: { 'vista.intro': true } }, barrio: { estado: { tortillas: true } } },
  });
});

test('sin partida anterior, la partida solo tiene el nivel actual', () => {
  expect(actualizarPartida(undefined, 'barrio', {})).toEqual({ v: 1, nivel: 'barrio', niveles: { barrio: { estado: {} } } });
});

test('las variables guardadas de un nivel se buscan por su id', () => {
  const partida: Partida = { v: 1, nivel: 'barrio', niveles: { barrio: { estado: { tortillas: true } } } };

  expect(variablesGuardadasDe(partida, 'barrio')).toEqual({ tortillas: true });
  expect(variablesGuardadasDe(partida, 'casa')).toBeUndefined();
  expect(variablesGuardadasDe(partida, 'constructor')).toBeUndefined();
  expect(variablesGuardadasDe(undefined, 'barrio')).toBeUndefined();
});
