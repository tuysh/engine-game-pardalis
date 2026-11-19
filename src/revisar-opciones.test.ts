import { expect, test } from 'bun:test';
import { revisarOpciones } from './revisar-opciones.ts';

const SIN_PROBLEMAS = { errores: [], advertencias: [] };

test('unas opciones bien escritas no tienen errores ni advertencias', () => {
  const revision = revisarOpciones({
    niveles: { casa: '/niveles/casa/nivel.json', barrio: '/niveles/barrio/nivel.json' },
    nivel: 'casa',
    minijuegos: { Tortilleria: async () => ({ exito: true }) },
    cinematicas: { intro: async () => {} },
    partida: null,
    idioma: 'es',
    iniciarCon: 'boton',
    proyeccion: false,
    origenesPermitidos: ['https://assets.pardalis.mx'],
    alCargar: () => {},
    senal: new AbortController().signal,
    semilla: 7,
  });

  expect(revision).toEqual(SIN_PROBLEMAS);
});

test('basta con la dirección de un nivel', () => {
  expect(revisarOpciones({ nivel: '/niveles/casa/nivel.json' })).toEqual(SIN_PROBLEMAS);
});

test('sin opciones, el mensaje dice cuál es la mínima', () => {
  expect(revisarOpciones(undefined).errores).toEqual([
    'opciones: el segundo argumento de crearEscenario() debe ser un objeto con las opciones; ' +
      `la única obligatoria es "nivel", por ejemplo { nivel: '/niveles/casa/nivel.json' }; llegó undefined`,
  ]);
});

test('sin nivel inicial, lo dice', () => {
  expect(revisarOpciones({ niveles: { casa: '/niveles/casa/nivel.json' } }).errores).toEqual([
    'opciones.nivel: falta el nivel inicial; debe ser un id de "niveles" o la dirección de un nivel.json; ' +
      'llegó undefined',
  ]);
});

test('un id de nivel mal escrito se detecta, y el mensaje lista los que sí existen', () => {
  const revision = revisarOpciones({
    niveles: { casa: '/niveles/casa/nivel.json', barrio: '/niveles/barrio/nivel.json' },
    nivel: 'csa',
  });

  expect(revision.errores).toEqual([
    'opciones.nivel: "csa" no está en "niveles" (casa, barrio) ni es la dirección de un nivel.json',
  ]);
});

test('un id de nivel sin "niveles" donde buscarlo es un error', () => {
  expect(revisarOpciones({ nivel: 'casa' }).errores).toEqual([
    'opciones.nivel: "casa" no es la dirección de un nivel.json, y no hay "niveles" donde buscarlo por id',
  ]);
});

test('una dirección de nivel que no es un texto se señala con su id', () => {
  const revision = revisarOpciones({ niveles: { casa: 42 }, nivel: 'casa' });

  expect(revision.errores).toEqual(['opciones.niveles.casa: debe ser la dirección de un nivel.json; llegó 42']);
});

test('un minijuego o una cinemática que no es una función se señala por su nombre', () => {
  const revision = revisarOpciones({
    nivel: '/niveles/casa/nivel.json',
    minijuegos: { Tortilleria: undefined },
    cinematicas: { intro: 'intro' },
  });

  expect(revision.errores).toEqual([
    'opciones.minijuegos.Tortilleria: debe ser una función; llegó undefined ' +
      '(¿falta importarla o está mal escrito su nombre?)',
    'opciones.cinematicas.intro: debe ser una función; llegó "intro" ' +
      '(¿falta importarla o está mal escrito su nombre?)',
  ]);
});

test('cada ajuste dice lo que acepta y lo que llegó', () => {
  const revision = revisarOpciones({
    nivel: '/niveles/casa/nivel.json',
    idioma: 'fr',
    iniciarCon: 'clic',
    origenesPermitidos: 'https://assets.pardalis.mx',
    proyeccion: 'si',
    semilla: Number.NaN,
  });

  expect(revision.errores).toEqual([
    'opciones.idioma: debe ser "es" o "en"; llegó "fr"',
    'opciones.iniciarCon: debe ser "boton" o "host"; llegó "clic"',
    'opciones.origenesPermitidos: debe ser una lista de orígenes, como ["https://assets.pardalis.mx"]; ' +
      'llegó "https://assets.pardalis.mx"',
    'opciones.semilla: debe ser un número; llegó NaN',
    'opciones.proyeccion: debe ser true o false; llegó "si"',
  ]);
});

test('una opción que no existe solo se advierte, y el mensaje lista las que sí', () => {
  const revision = revisarOpciones({ nivel: '/niveles/casa/nivel.json', minijuego: {} });

  expect(revision.errores).toEqual([]);
  expect(revision.advertencias).toEqual([
    'opciones.minijuego: esa opción no existe y se ignora; las opciones son: niveles, nivel, minijuegos, ' +
      'cinematicas, partida, raizDeAssets, origenesPermitidos, idioma, iniciarCon, proyeccion, alCargar, ' +
      'senal, depurar, semilla',
  ]);
});
