import { expect, test } from 'bun:test';
import { quitarOpcionesVacias, revisarOpciones } from './revisar-opciones.ts';

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
    'opciones.nivel: falta el nivel inicial; debe ser un id de "niveles" o la dirección de un nivel.json',
  ]);
});

test('un nivel inicial que no es un texto dice qué llegó', () => {
  expect(revisarOpciones({ nivel: 42 }).errores).toEqual([
    'opciones.nivel: debe ser un id de "niveles" o la dirección de un nivel.json; llegó 42',
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

test('sin niveles registrados, el nivel se toma como dirección aunque sea una palabra suelta', () => {
  // `nivel` puede ser una dirección relativa a la página, como "nivel" o "nivel?id=3".
  expect(revisarOpciones({ nivel: 'nivel' })).toEqual(SIN_PROBLEMAS);
  expect(revisarOpciones({ niveles: {}, nivel: 'nivel?id=3' })).toEqual(SIN_PROBLEMAS);
});

test('con "niveles" mal escrito solo se señala eso, sin un segundo error sobre el nivel inicial', () => {
  expect(revisarOpciones({ niveles: ['casa'], nivel: 'casa' }).errores).toEqual([
    'opciones.niveles: debe ser un objeto que une el id de cada nivel con la dirección de su nivel.json; ' +
      'llegó una lista',
  ]);
});

test('una opción en null cuenta igual que no ponerla', () => {
  // Así llega, por ejemplo, `idioma: localStorage.getItem('idioma')` cuando no hay nada guardado.
  const revision = revisarOpciones({
    nivel: '/niveles/casa/nivel.json',
    niveles: null,
    minijuegos: null,
    cinematicas: null,
    partida: null,
    raizDeAssets: null,
    origenesPermitidos: null,
    idioma: null,
    iniciarCon: null,
    proyeccion: null,
    alCargar: null,
    senal: null,
    depurar: null,
    semilla: null,
  });

  expect(revision).toEqual(SIN_PROBLEMAS);
});

test('el nivel inicial en null sí es un error: es la única opción obligatoria', () => {
  expect(revisarOpciones({ nivel: null }).errores).toEqual([
    'opciones.nivel: falta el nivel inicial; debe ser un id de "niveles" o la dirección de un nivel.json',
  ]);
});

test('quitar las opciones vacías deja solo las que traen algo, sin tocar el objeto del host', () => {
  const alCargar = (): void => {};
  // Así llegan desde JavaScript sin tipos: con opciones en null.
  const delHost = JSON.parse('{ "nivel": "casa", "idioma": null, "proyeccion": false, "semilla": 0 }');
  delHost.alCargar = alCargar;

  expect(quitarOpcionesVacias(delHost)).toEqual({ nivel: 'casa', proyeccion: false, semilla: 0, alCargar });
  expect(delHost.idioma).toBeNull();
});

test('la señal se reconoce por lo que sabe hacer: sirve la de otra ventana, y no cualquier objeto', () => {
  const senalDeOtraVentana = { aborted: false, throwIfAborted: () => {}, addEventListener: () => {} };
  const nivel = '/niveles/casa/nivel.json';

  expect(revisarOpciones({ nivel, senal: senalDeOtraVentana })).toEqual(SIN_PROBLEMAS);
  expect(revisarOpciones({ nivel, senal: new AbortController() }).errores).toEqual([
    'opciones.senal: debe ser la señal de un AbortController (controlador.signal); llegó un objeto',
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
    pausarAlOcultar: 'no',
    semilla: Number.NaN,
  });

  expect(revision.errores).toEqual([
    'opciones.idioma: debe ser "es" o "en"; llegó "fr"',
    'opciones.iniciarCon: debe ser "boton" o "host"; llegó "clic"',
    'opciones.origenesPermitidos: debe ser una lista de orígenes, como ["https://assets.pardalis.mx"]; ' +
      'llegó "https://assets.pardalis.mx"',
    'opciones.semilla: debe ser un número; llegó NaN',
    'opciones.proyeccion: debe ser true o false; llegó "si"',
    'opciones.pausarAlOcultar: debe ser true o false; llegó "no"',
  ]);
});

test('una opción que no existe solo se advierte, y el mensaje lista las que sí', () => {
  const revision = revisarOpciones({ nivel: '/niveles/casa/nivel.json', minijuego: {} });

  expect(revision.errores).toEqual([]);
  expect(revision.advertencias).toEqual([
    'opciones.minijuego: esa opción no existe y se ignora; las opciones son: niveles, nivel, minijuegos, ' +
      'cinematicas, partida, raizDeAssets, origenesPermitidos, idioma, iniciarCon, proyeccion, pausarAlOcultar, ' +
      'alCargar, senal, depurar, semilla',
  ]);
});
