import { expect, test } from 'bun:test';
import { leerCondicionDeTexto } from './condicion.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from './contenido.ts';
import type { Contenido } from './contenido.ts';
import { crearDiagnostico } from './diagnostico.ts';
import type { Diagnostico } from './diagnostico.ts';
import type { Paso } from './paso.ts';
import { revisarEnlaces } from './revisar-enlaces.ts';

/** Un contenido pequeño y correcto. Cada prueba le cambia solo lo que quiere comprobar. */
const CONTENIDO_CORRECTO: Contenido = {
  meta: {
    id: 'tortilleria',
    titulo: 'La Tortillería',
    personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' }, tortu: { idioma: 'es', sprite: 'spr_tortu' } },
  },
  jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2.4 },
  mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
  estado: { objetivos: ['tortillas'], variables: ['globo'], lista: {} },
  secuencias: { despedida: [{ tipo: 'linea', hablante: 'tortu', texto: '¡Adiós!' }] },
  npcs: { tortu: { dialogo: [{ pasos: [{ tipo: 'linea', hablante: 'tortu', texto: '¡Hola!' }] }] } },
  interactivos: {},
  cinematicas: {},
  comentarios: {},
};

/** Pone los pasos como único diálogo de "tortu" y devuelve lo que encontró la revisión. */
function revisarPasosDeTortu(pasos: Paso[], minijuegos?: string[]): Diagnostico {
  const contenido: Contenido = { ...CONTENIDO_CORRECTO, npcs: { tortu: { dialogo: [{ pasos }] } } };
  const diagnostico = crearDiagnostico();
  revisarEnlaces(contenido, { minijuegos }, diagnostico);
  return diagnostico;
}

test('un contenido correcto no tiene errores ni advertencias', () => {
  const diagnostico = crearDiagnostico();

  revisarEnlaces(CONTENIDO_CORRECTO, {}, diagnostico);

  expect(diagnostico).toEqual({ errores: [], advertencias: [] });
});

test('el personaje del jugador debe existir', () => {
  const contenido: Contenido = { ...CONTENIDO_CORRECTO, jugador: { personaje: 'tomy', velocidadEnMetrosPorSegundo: 2.4 } };
  const diagnostico = crearDiagnostico();

  revisarEnlaces(contenido, {}, diagnostico);

  expect(diagnostico.errores).toEqual(['jugador.personaje "tomy" no existe en meta.personajes']);
});

test('el hablante de una línea debe existir', () => {
  const diagnostico = revisarPasosDeTortu([{ tipo: 'linea', hablante: 'tortuga', texto: '¡Hola!' }]);

  expect(diagnostico.errores).toEqual([
    'npcs.tortu.dialogo[0].dice[0]: el hablante "tortuga" no existe en meta.personajes',
  ]);
});

test('un texto no puede usar una variable entre llaves que no existe', () => {
  const diagnostico = revisarPasosDeTortu([{ tipo: 'linea', hablante: 'tortu', texto: 'Te faltan {falta}.' }]);

  expect(diagnostico.errores).toEqual([
    'npcs.tortu.dialogo[0].dice[0]: el texto usa {falta}, que no existe; se puede usar {faltan} y {dinero}',
  ]);
});

test('una condición solo puede usar variables declaradas', () => {
  const diagnostico = revisarPasosDeTortu([
    { tipo: 'condicional', condicion: leerCondicionDeTexto('tengo limones'), pasos: [] },
  ]);

  expect(diagnostico.errores).toEqual([
    'condición "limones" usada en npcs.tortu.dialogo[0].dice[0]: no está en estado.objetivos, ni en estado.variables, ni en estado.compartidas',
  ]);
});

test('"charlas.<id>" está declarada para cada NPC e interactivo, sin escribirla en el estado', () => {
  const diagnostico = revisarPasosDeTortu([
    { tipo: 'condicional', condicion: leerCondicionDeTexto('charlas.tortu'), pasos: [] },
  ]);

  expect(diagnostico.errores).toEqual([]);
});

test('"charlas.<id>" de alguien que no existe explica que falta ese NPC o interactivo', () => {
  const diagnostico = revisarPasosDeTortu([
    { tipo: 'condicional', condicion: leerCondicionDeTexto('charlas.pancho'), pasos: [] },
  ]);

  expect(diagnostico.errores).toEqual([
    'condición "charlas.pancho" usada en npcs.tortu.dialogo[0].dice[0]: no existe "pancho" en npcs ni en interactivos',
  ]);
});

test('"dinero" solo está declarado si el nivel empieza con dinero', () => {
  const pasos: Paso[] = [{ tipo: 'pon', valores: { dinero: 50 } }];
  const sinDinero: Contenido = { ...CONTENIDO_CORRECTO, npcs: { tortu: { dialogo: [{ pasos }] } } };
  const conDinero: Contenido = { ...sinDinero, estado: { ...sinDinero.estado, dinero: 100 } };
  const diagnosticoSinDinero = crearDiagnostico();
  const diagnosticoConDinero = crearDiagnostico();

  revisarEnlaces(sinDinero, {}, diagnosticoSinDinero);
  revisarEnlaces(conDinero, {}, diagnosticoConDinero);

  expect(diagnosticoSinDinero.errores).toEqual([
    '"pon" de "dinero" en npcs.tortu.dialogo[0].dice[0]: no está en estado.objetivos, ni en estado.variables, ni en estado.compartidas',
  ]);
  expect(diagnosticoConDinero.errores).toEqual([]);
});

test('un efecto que no existe lista los disponibles', () => {
  const diagnostico = revisarPasosDeTortu([{ tipo: 'efecto', nombre: 'chispas' }]);

  expect(diagnostico.errores).toEqual([
    'efecto "chispas" en npcs.tortu.dialogo[0].dice[0] no existe; los disponibles son: magia, confeti',
  ]);
});

test('un minijuego que el host no registró es un error', () => {
  const pasos: Paso[] = [{ tipo: 'juego', nombre: 'Fruteria', config: undefined }];

  const diagnostico = revisarPasosDeTortu(pasos, ['Tortilleria']);

  expect(diagnostico.errores).toEqual([
    'minijuego "Fruteria" usado en npcs.tortu.dialogo[0].dice[0] pero el host no lo registró en "minijuegos"',
  ]);
});

test('si no se sabe qué minijuegos registró el host, no se revisan', () => {
  const pasos: Paso[] = [{ tipo: 'juego', nombre: 'Fruteria', config: undefined }];

  const diagnostico = revisarPasosDeTortu(pasos, undefined);

  expect(diagnostico.errores).toEqual([]);
});

test('quien camina debe ser un personaje', () => {
  const diagnostico = revisarPasosDeTortu([{ tipo: 'camina', punto: 'frente', personaje: 'tortuga' }]);

  expect(diagnostico.errores).toEqual([
    'camina en npcs.tortu.dialogo[0].dice[0]: "quien": "tortuga" no existe en meta.personajes',
  ]);
});

test('en un nivel sin jugador, toda caminata debe decir quién camina', () => {
  const pasos: Paso[] = [{ tipo: 'camina', punto: 'frente' }];
  const contenido: Contenido = { ...CONTENIDO_CORRECTO, jugador: undefined, npcs: { tortu: { dialogo: [{ pasos }] } } };
  const diagnostico = crearDiagnostico();

  revisarEnlaces(contenido, {}, diagnostico);

  expect(diagnostico.errores).toEqual([
    'camina en npcs.tortu.dialogo[0].dice[0]: el nivel no tiene jugador; indica quién camina con "quien"',
  ]);
});

test('una secuencia usada por nombre debe existir, con la ruta de donde se usa', () => {
  const contenido: Contenido = {
    ...CONTENIDO_CORRECTO,
    npcs: {
      tortu: {
        dialogo: [{ pasos: [{ tipo: 'secuencia', nombre: 'saludo' }] }],
        alVolver: {
          siLogrado: { tipo: 'secuencia', nombre: 'despedida' },
          siNo: { tipo: 'secuencia', nombre: 'aun_no_item' },
        },
      },
    },
  };
  const diagnostico = crearDiagnostico();

  revisarEnlaces(contenido, {}, diagnostico);

  expect(diagnostico.errores).toEqual([
    'secuencia "saludo" usada en npcs.tortu.dialogo[0].dice[0] pero no existe en "secuencias"',
    'secuencia "aun_no_item" usada en npcs.tortu.alVolver.siNo pero no existe en "secuencias"',
  ]);
});

test('se revisan también los pasos de adentro de un condicional y de una opción', () => {
  const diagnostico = revisarPasosDeTortu([
    {
      tipo: 'condicional',
      condicion: leerCondicionDeTexto('globo'),
      pasos: [{ tipo: 'efecto', nombre: 'chispas' }],
    },
    {
      tipo: 'elige',
      pregunta: '¿Cuál quieres?',
      opciones: [{ imagen: 'img_rosa', alElegir: { tipo: 'pasos', pasos: [{ tipo: 'efecto', nombre: 'humo' }] } }],
    },
  ]);

  expect(diagnostico.errores).toEqual([
    'efecto "chispas" en npcs.tortu.dialogo[0].dice[0].dice[0] no existe; los disponibles son: magia, confeti',
    'efecto "humo" en npcs.tortu.dialogo[0].dice[1].opciones[0].secuencia[0] no existe; los disponibles son: magia, confeti',
  ]);
});

test('una rama después de otra sin condición es inalcanzable (advertencia)', () => {
  const contenido: Contenido = {
    ...CONTENIDO_CORRECTO,
    npcs: { tortu: { dialogo: [{ pasos: [] }, { condicion: leerCondicionDeTexto('tengo tortillas'), pasos: [] }] } },
  };
  const diagnostico = crearDiagnostico();

  revisarEnlaces(contenido, {}, diagnostico);

  expect(diagnostico.errores).toEqual([]);
  expect(diagnostico.advertencias).toEqual([
    'npcs.tortu.dialogo[1]: rama inalcanzable, hay una rama sin "cuando" antes; deja la rama sin "cuando" al final',
  ]);
});

test('una opción sin imagen es una advertencia: nada debe requerir leer', () => {
  const diagnostico = revisarPasosDeTortu([
    {
      tipo: 'elige',
      pregunta: '¿Cuál quieres?',
      opciones: [
        { imagen: 'img_rosa', alElegir: { tipo: 'pasos', pasos: [] } },
        { texto: 'El azul', alElegir: { tipo: 'pasos', pasos: [] } },
      ],
    },
  ]);

  expect(diagnostico.errores).toEqual([]);
  expect(diagnostico.advertencias).toEqual([
    'npcs.tortu.dialogo[0].dice[0].opciones[1]: opción sin "imagen"; quien todavía no lee no puede distinguirla',
  ]);
});

test('si todas las opciones tienen condición, se avisa que el paso puede saltarse', () => {
  const diagnostico = revisarPasosDeTortu([
    {
      tipo: 'elige',
      pregunta: '¿Cuál quieres?',
      opciones: [
        { imagen: 'img_rosa', condicion: leerCondicionDeTexto('globo'), alElegir: { tipo: 'pasos', pasos: [] } },
      ],
    },
  ]);

  expect(diagnostico.advertencias).toEqual([
    'npcs.tortu.dialogo[0].dice[0]: todas las opciones tienen "cuando"; si ninguna se cumple, el paso se salta',
  ]);
});

test('las condiciones de la salida también se revisan', () => {
  const contenido: Contenido = {
    ...CONTENIDO_CORRECTO,
    salida: {
      destino: 'Selector',
      requiere: leerCondicionDeTexto('tengo limones'),
      flecha: { visibleCuando: leerCondicionDeTexto('tengo aguacates') },
    },
  };
  const diagnostico = crearDiagnostico();

  revisarEnlaces(contenido, {}, diagnostico);

  expect(diagnostico.errores).toEqual([
    'condición "limones" usada en salida.requiere: no está en estado.objetivos, ni en estado.variables, ni en estado.compartidas',
    'condición "aguacates" usada en salida.flecha.visibleCuando: no está en estado.objetivos, ni en estado.variables, ni en estado.compartidas',
  ]);
});

test('no se puede sacar del escenario al personaje del jugador', () => {
  const diagnostico = revisarPasosDeTortu([
    { tipo: 'desaparece', personaje: 'tommy' },
    { tipo: 'desaparece', personaje: 'tortu' },
  ]);

  expect(diagnostico.errores).toEqual([
    'npcs.tortu.dialogo[0].dice[0]: "desaparece": "tommy" no se puede usar: ' +
      'es el personaje del jugador y debe seguir en el escenario',
  ]);
});

test('la variable de una comparación y la de una suma deben estar declaradas', () => {
  const diagnostico = revisarPasosDeTortu([
    { tipo: 'condicional', condicion: leerCondicionDeTexto('dinero >= 10'), pasos: [] },
    { tipo: 'pon', valores: { estrellas: { suma: 1 } } },
  ]);

  expect(diagnostico.errores).toEqual([
    'condición "dinero" usada en npcs.tortu.dialogo[0].dice[0]: no está en estado.objetivos, ni en estado.variables, ni en estado.compartidas',
    '"pon" de "estrellas" en npcs.tortu.dialogo[0].dice[1]: no está en estado.objetivos, ni en estado.variables, ni en estado.compartidas',
  ]);
});

test('una comparación sin número a la derecha explica cómo se escribe', () => {
  const diagnostico = revisarPasosDeTortu([
    { tipo: 'condicional', condicion: leerCondicionDeTexto('globo >= mucho'), pasos: [] },
  ]);

  expect(diagnostico.errores).toEqual([
    'condición "globo >= mucho" usada en npcs.tortu.dialogo[0].dice[0]: una comparación lleva el nombre de ' +
      'una variable, un signo (>=, <=, >, < o =) y un número, como "dinero >= 10"',
  ]);
});

test('quien reacciona a una línea debe ser un personaje', () => {
  const diagnostico = revisarPasosDeTortu([
    { tipo: 'linea', hablante: 'tortu', texto: '¡Hola!', reacciones: { tomy: 'tommy_feliz' } },
  ]);

  expect(diagnostico.errores).toEqual([
    'npcs.tortu.dialogo[0].dice[0].reacciona: el personaje "tomy" no existe en meta.personajes',
  ]);
});

test('el acompañante del jugador debe ser otro personaje que exista', () => {
  const conAcompananteQueNoExiste: Contenido = {
    ...CONTENIDO_CORRECTO,
    jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2.4, acompanante: 'bobby' },
  };
  const acompanadoDeSiMismo: Contenido = {
    ...CONTENIDO_CORRECTO,
    jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2.4, acompanante: 'tommy' },
  };
  const primerDiagnostico = crearDiagnostico();
  const segundoDiagnostico = crearDiagnostico();

  revisarEnlaces(conAcompananteQueNoExiste, {}, primerDiagnostico);
  revisarEnlaces(acompanadoDeSiMismo, {}, segundoDiagnostico);

  expect(primerDiagnostico.errores).toEqual(['jugador.acompanante "bobby" no existe en meta.personajes']);
  expect(segundoDiagnostico.errores).toEqual([
    'jugador.acompanante "tommy" es el mismo personaje del jugador: no puede acompañarse a sí mismo',
  ]);
});

test('el paso "acompana" necesita un nivel con jugador y a otro personaje', () => {
  const diagnostico = revisarPasosDeTortu([
    { tipo: 'acompana', personaje: 'tortu' },
    { tipo: 'acompana' },
    { tipo: 'acompana', personaje: 'tommy' },
    { tipo: 'acompana', personaje: 'pancho' },
  ]);

  expect(diagnostico.errores).toEqual([
    'npcs.tortu.dialogo[0].dice[2]: "acompana": "tommy" es el personaje del jugador: no puede acompañarse a sí mismo',
    'npcs.tortu.dialogo[0].dice[3]: el personaje "pancho" no existe en meta.personajes',
  ]);
});
