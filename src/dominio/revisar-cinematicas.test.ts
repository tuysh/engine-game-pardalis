import { expect, test } from 'bun:test';
import { leerCondicionDeTexto } from './condicion.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from './contenido.ts';
import type { Cinematica, Contenido } from './contenido.ts';
import { crearDiagnostico } from './diagnostico.ts';
import type { Diagnostico } from './diagnostico.ts';
import type { Paso } from './paso.ts';
import { revisarEnlaces } from './revisar-enlaces.ts';
import type { RegistrosDelHost } from './revisar-enlaces.ts';

/** Un contenido pequeño y correcto, sin cinemáticas. Cada prueba le pone las que quiere comprobar. */
const CONTENIDO: Contenido = {
  meta: {
    id: 'casa',
    titulo: 'La casa',
    personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' }, mama: { idioma: 'es', sprite: 'spr_mama' } },
  },
  jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2.4 },
  mundo: {
    ...AJUSTES_DEL_MUNDO_POR_DEFECTO,
    planos: { plano_sala: { mira: 'tommy', distanciaEnMetros: 6, alturaEnMetros: 2.5, giroEnGrados: 20 } },
  },
  estado: { objetivos: ['tortillas'], variables: [], lista: {} },
  secuencias: {
    pregunta: [
      {
        tipo: 'elige',
        pregunta: '¿Vas?',
        opciones: [{ imagen: 'img_si', alElegir: { tipo: 'pasos', pasos: [] } }],
      },
    ],
    recado: [{ tipo: 'secuencia', nombre: 'pregunta' }],
  },
  npcs: {},
  interactivos: {},
  cinematicas: {},
  comentarios: {},
};

/** Revisa el contenido con una cinemática llamada "intro" y devuelve lo que se encontró. */
function revisarCinematica(cinematica: Partial<Cinematica>, registros: RegistrosDelHost = {}): Diagnostico {
  const intro: Cinematica = {
    inicio: { tipo: 'alEntrar' },
    condicion: leerCondicionDeTexto('no vista.intro'),
    saltable: true,
    guion: { tipo: 'pasos', pasos: [] },
    ...cinematica,
  };
  const diagnostico = crearDiagnostico();
  revisarEnlaces({ ...CONTENIDO, cinematicas: { intro } }, registros, diagnostico);
  return diagnostico;
}

function revisarPasos(pasos: Paso[]): Diagnostico {
  return revisarCinematica({ guion: { tipo: 'pasos', pasos } });
}

test('una cinemática correcta no tiene errores, y "vista.<id>" está declarada sin escribirla en el estado', () => {
  const diagnostico = revisarPasos([
    { tipo: 'fundido', sentido: 'abrir', duracionEnSegundos: 1 },
    { tipo: 'camara', destino: 'plano_sala', duracionEnSegundos: 2 },
    { tipo: 'camara', destino: 'mama', duracionEnSegundos: 0 },
    { tipo: 'camara', destino: 'jugador', duracionEnSegundos: 0 },
    { tipo: 'linea', hablante: 'mama', texto: '¿Me traes tortillas, mijo?' },
    { tipo: 'sale', destino: 'barrio' },
  ]);

  expect(diagnostico).toEqual({ errores: [], advertencias: [] });
});

test('"vista.<id>" de una cinemática que no existe explica que falta esa cinemática', () => {
  const diagnostico = revisarCinematica({ condicion: leerCondicionDeTexto('no vista.final') });

  expect(diagnostico.errores).toEqual([
    'condición "vista.final" usada en cinematicas.intro.cuando: no existe la cinemática "final"',
  ]);
});

test('el objetivo que hace empezar una cinemática debe estar declarado', () => {
  const diagnostico = revisarCinematica({ inicio: { tipo: 'objetivo', objetivo: 'aguacates' } });

  expect(diagnostico.errores).toEqual([
    'cinematicas.intro.inicia: el objetivo "aguacates" no está en estado.objetivos',
  ]);
});

test('una cinemática en código debe estar registrada en el host, si se sabe qué registró', () => {
  const guion = { tipo: 'codigo', nombre: 'intro' } as const;

  expect(revisarCinematica({ guion }, { cinematicas: ['final'] }).errores).toEqual([
    'cinematicas.intro.codigo: la cinemática en código "intro" no está registrada en el host ("cinematicas")',
  ]);
  expect(revisarCinematica({ guion }, { cinematicas: ['intro'] }).errores).toEqual([]);
  expect(revisarCinematica({ guion }, {}).errores).toEqual([]);
});

test('una cinemática no puede llevar "elige" ni "juego", tampoco dentro de "juntos" o de una secuencia', () => {
  const diagnostico = revisarPasos([
    { tipo: 'juego', nombre: 'Tortilleria', config: undefined },
    { tipo: 'juntos', pasos: [{ tipo: 'juego', nombre: 'Tortilleria', config: undefined }] },
    { tipo: 'secuencia', nombre: 'recado' },
    { tipo: 'espera', esperaEnSegundos: 1 },
  ]);

  expect(diagnostico.errores).toEqual([
    'cinematicas.intro.pasos[0]: una cinemática no puede llevar "juego", que necesita al jugador',
    'cinematicas.intro.pasos[1]: una cinemática no puede llevar "juego", que necesita al jugador',
    'cinematicas.intro.pasos[2]: una cinemática no puede llevar "elige", que necesita al jugador',
  ]);
});

test('los pasos de escena deben nombrar personajes que existen', () => {
  const diagnostico = revisarPasos([
    { tipo: 'mira', personaje: 'papa', hacia: 'mama' },
    { tipo: 'anima', personaje: 'papa', clave: 'papa_saluda', repite: false },
    { tipo: 'aparece', personaje: 'papa', punto: 'puerta' },
    { tipo: 'desaparece', personaje: 'papa' },
  ]);

  // "anima" también puede nombrar un objeto del decorado: eso se revisa al cruzar con el mapa, no aquí.
  expect(diagnostico.errores).toEqual([
    'cinematicas.intro.pasos[0]: el personaje "papa" no existe en meta.personajes',
    'cinematicas.intro.pasos[2]: el personaje "papa" no existe en meta.personajes',
    'cinematicas.intro.pasos[3]: el personaje "papa" no existe en meta.personajes',
  ]);
});

test('la cámara solo puede ir a un plano, a un personaje o al jugador', () => {
  const diagnostico = revisarPasos([{ tipo: 'camara', destino: 'plano_cocina', duracionEnSegundos: 1 }]);

  expect(diagnostico.errores).toEqual([
    'cinematicas.intro.pasos[0]: "camara": "plano_cocina" no es un plano de mundo.planos, ' +
      'ni un personaje, ni "jugador"',
  ]);
});

test('en un nivel sin jugador, la cámara no puede ir al jugador', () => {
  const intro: Cinematica = {
    inicio: { tipo: 'alEntrar' },
    condicion: leerCondicionDeTexto('no vista.intro'),
    saltable: true,
    guion: { tipo: 'pasos', pasos: [{ tipo: 'camara', destino: 'jugador', duracionEnSegundos: 0 }] },
  };
  const diagnostico = crearDiagnostico();

  revisarEnlaces({ ...CONTENIDO, jugador: undefined, cinematicas: { intro } }, {}, diagnostico);

  expect(diagnostico.errores).toEqual([
    'cinematicas.intro.pasos[0]: "camara": "jugador" no se puede usar: el nivel no tiene jugador',
  ]);
});

test('los pasos de adentro de "juntos" también se revisan, con su ruta', () => {
  const diagnostico = revisarPasos([
    { tipo: 'juntos', pasos: [{ tipo: 'espera', esperaEnSegundos: 1 }, { tipo: 'efecto', nombre: 'chispas' }] },
  ]);

  expect(diagnostico.errores).toEqual([
    'efecto "chispas" en cinematicas.intro.pasos[0].juntos[1] no existe; los disponibles son: magia, confeti, destello',
  ]);
});
