import { expect, test } from 'bun:test';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from './contenido.ts';
import type { Contenido } from './contenido.ts';
import { crearDiagnostico } from './diagnostico.ts';
import type { Diagnostico } from './diagnostico.ts';
import type { Mundo } from './mundo.ts';
import { revisarCruce } from './revisar-cruce.ts';

/** Un contenido y un mundo pequeños que coinciden. Cada prueba cambia solo lo que quiere comprobar. */
const CONTENIDO: Contenido = {
  meta: {
    id: 'barrio',
    titulo: 'El barrio',
    personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' }, tortu: { idioma: 'es', sprite: 'spr_tortu' } },
  },
  jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2.4 },
  mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
  estado: { objetivos: [], variables: [], lista: {} },
  secuencias: {},
  npcs: { tortu: { dialogo: [{ pasos: [{ tipo: 'camina', punto: 'frente' }] }] } },
  interactivos: { comal: { dialogo: [] } },
  cinematicas: {},
  comentarios: { general: [] },
  salida: { destino: 'Selector' },
};

const MUNDO: Mundo = {
  anchoEnMetros: 10,
  profundidadEnMetros: 6,
  telones: [],
  decorado: [
    {
      descripcion: 'objeto #2 "Comal"',
      clase: 'parado',
      asset: 'comal',
      huella: { x: 6, y: 2, ancho: 1, alto: 0.5 },
      alturaEnMetros: 0,
      id: 'comal',
    },
  ],
  npcs: { tortu: { descripcion: 'objeto #3 "Doña Tortu"', posicion: { x: 5, y: 2 }, mira: 'izquierda' } },
  iniciosDelJugador: [{ descripcion: 'objeto #4', posicion: { x: 2, y: 3 }, mira: 'derecha' }],
  puntos: { frente: { x: 5, y: 3 } },
  salida: { descripcion: 'objeto #5', forma: { tipo: 'rectangulo', rectangulo: { x: 9, y: 2, ancho: 1, alto: 2 } } },
  zonas: {
    entrada: {
      descripcion: 'objeto #6 "entrada"',
      forma: { tipo: 'rectangulo', rectangulo: { x: 1, y: 2, ancho: 2, alto: 2 } },
      grupo: 'general',
      esperaEnSegundos: 20,
    },
  },
  pisos: [[{ x: 0, y: 1 }, { x: 10, y: 1 }, { x: 10, y: 6 }, { x: 0, y: 6 }]],
};

function revisar(contenido: Contenido, mundo: Mundo): Diagnostico {
  const diagnostico = crearDiagnostico();
  revisarCruce(contenido, mundo, diagnostico);
  return diagnostico;
}

test('un mapa y un contenido que coinciden no tienen errores ni advertencias', () => {
  expect(revisar(CONTENIDO, MUNDO)).toEqual({ errores: [], advertencias: [] });
});

test('un NPC del mapa debe ser un personaje del contenido', () => {
  const mundo: Mundo = {
    ...MUNDO,
    npcs: { ...MUNDO.npcs, gato: { descripcion: 'objeto #9 "Gato"', posicion: { x: 1, y: 2 }, mira: 'derecha' } },
  };

  expect(revisar(CONTENIDO, mundo).errores).toEqual([
    'mapa: objeto #9 "Gato" (npc) tiene id "gato", que no existe en meta.personajes',
  ]);
});

test('un NPC del mapa sin diálogo en el contenido está permitido: solo no se puede tocar', () => {
  const contenido: Contenido = { ...CONTENIDO, npcs: {} };

  expect(revisar(contenido, MUNDO).errores).toEqual([]);
});

test('un diálogo de "npcs" necesita su objeto en el mapa', () => {
  const mundo: Mundo = { ...MUNDO, npcs: {} };

  expect(revisar(CONTENIDO, mundo).errores).toEqual([
    'npcs.tortu no tiene un objeto con ese id en la capa "npcs" del mapa',
  ]);
});

test('los interactivos deben coincidir en los dos sentidos', () => {
  const contenidoSinComal: Contenido = { ...CONTENIDO, interactivos: {} };
  const mundoSinComal: Mundo = { ...MUNDO, decorado: [] };

  expect(revisar(contenidoSinComal, MUNDO).errores).toEqual([
    'mapa: objeto #2 "Comal" (decorado) tiene id "comal", que no existe en interactivos',
  ]);
  expect(revisar(CONTENIDO, mundoSinComal).errores).toEqual([
    'interactivos.comal no tiene un objeto con ese id en la capa "decorado" del mapa',
  ]);
});

test('el mapa necesita al menos un polígono de piso', () => {
  const mundo: Mundo = { ...MUNDO, pisos: [] };

  expect(revisar(CONTENIDO, mundo).errores).toEqual([
    'mapa: la capa "piso" necesita al menos un polígono por donde caminar',
    'mapa: objeto #4 (inicioJugador) debe estar dentro de un polígono de la capa "piso"',
  ]);
});

test('un nivel con jugador necesita exactamente un inicio', () => {
  const sinInicio: Mundo = { ...MUNDO, iniciosDelJugador: [] };

  expect(revisar(CONTENIDO, sinInicio).errores).toEqual([
    'mapa: el nivel tiene jugador, así que la capa "interaccion" necesita exactamente un objeto de clase inicioJugador (hay 0)',
  ]);
});

test('el inicio del jugador debe estar dentro del piso', () => {
  const mundo: Mundo = {
    ...MUNDO,
    iniciosDelJugador: [{ descripcion: 'objeto #4', posicion: { x: 2, y: 0.5 }, mira: 'derecha' }],
  };

  expect(revisar(CONTENIDO, mundo).errores).toEqual([
    'mapa: objeto #4 (inicioJugador) debe estar dentro de un polígono de la capa "piso"',
  ]);
});

test('en un nivel sin jugador, un inicio en el mapa solo da advertencia', () => {
  const contenido: Contenido = { ...CONTENIDO, jugador: undefined, npcs: {} };

  expect(revisar(contenido, MUNDO)).toEqual({
    errores: [],
    advertencias: ['mapa: hay un objeto inicioJugador, pero el contenido no tiene "jugador"; se ignora'],
  });
});

test('el grupo de una zona debe existir en los comentarios', () => {
  const contenido: Contenido = { ...CONTENIDO, comentarios: {} };

  expect(revisar(contenido, MUNDO).errores).toEqual([
    'mapa: objeto #6 "entrada" (zona) usa el grupo "general", que no existe en comentarios',
  ]);
});

test('la salida del contenido necesita su objeto en el mapa; al revés solo es advertencia', () => {
  const mundoSinSalida: Mundo = { ...MUNDO, salida: undefined };
  const contenidoSinSalida: Contenido = { ...CONTENIDO, salida: undefined };

  expect(revisar(CONTENIDO, mundoSinSalida).errores).toEqual([
    'salida: falta un objeto de clase salida en la capa "interaccion" del mapa',
  ]);
  expect(revisar(contenidoSinSalida, MUNDO)).toEqual({
    errores: [],
    advertencias: ['mapa: objeto #5 (salida) no hace nada: el contenido no tiene la sección "salida"'],
  });
});

test('el destino de una caminata debe ser un punto del mapa', () => {
  const mundo: Mundo = { ...MUNDO, puntos: {} };

  expect(revisar(CONTENIDO, mundo).errores).toEqual([
    'camina "frente" en npcs.tortu.dialogo[0].dice[0]: no hay un punto con ese nombre en el mapa',
  ]);
});

test('quien camina debe estar en el escenario: ser el jugador o un NPC del mapa', () => {
  const contenido: Contenido = {
    ...CONTENIDO,
    meta: {
      ...CONTENIDO.meta,
      personajes: { ...CONTENIDO.meta.personajes, mama: { idioma: 'es', sprite: 'spr_mama' } },
    },
    secuencias: {
      paseo: [
        { tipo: 'camina', punto: 'frente', personaje: 'tommy' },
        { tipo: 'camina', punto: 'frente', personaje: 'tortu' },
        { tipo: 'camina', punto: 'frente', personaje: 'mama' },
      ],
    },
  };

  expect(revisar(contenido, MUNDO).errores).toEqual([
    'secuencias.paseo[2]: "mama" nunca está en el escenario: no es el jugador, ni un NPC del mapa, ' +
      'ni entra con un paso "aparece"',
  ]);
});

test('quien entra con un paso "aparece" sí está en el escenario, y su punto debe existir', () => {
  const contenido: Contenido = {
    ...CONTENIDO,
    meta: {
      ...CONTENIDO.meta,
      personajes: { ...CONTENIDO.meta.personajes, mama: { idioma: 'es', sprite: 'spr_mama' } },
    },
    secuencias: {
      visita: [
        { tipo: 'aparece', personaje: 'mama', punto: 'puerta' },
        { tipo: 'camina', punto: 'frente', personaje: 'mama' },
        { tipo: 'mira', personaje: 'mama', hacia: 'tommy' },
        { tipo: 'mira', personaje: 'mama', hacia: 'ventana' },
        { tipo: 'desaparece', personaje: 'mama' },
      ],
    },
  };

  expect(revisar(contenido, MUNDO).errores).toEqual([
    'aparece "mama" en secuencias.visita[0]: no hay un punto llamado "puerta" en el mapa',
    'mira en secuencias.visita[3]: "hacia": "ventana" no es un personaje ni un punto del mapa',
  ]);
});

test('un plano de cámara debe apuntar a un personaje, a un punto del mapa o a un objeto con id', () => {
  const contenido: Contenido = {
    ...CONTENIDO,
    mundo: {
      ...CONTENIDO.mundo,
      planos: {
        a_tortu: { mira: 'tortu', distanciaEnMetros: 5, alturaEnMetros: 2, giroEnGrados: 0 },
        al_frente: { mira: 'frente', distanciaEnMetros: 5, alturaEnMetros: 2, giroEnGrados: 0 },
        al_comal: { mira: 'comal', distanciaEnMetros: 5, alturaEnMetros: 2, giroEnGrados: 0 },
        a_la_nada: { mira: 'sillon', distanciaEnMetros: 5, alturaEnMetros: 2, giroEnGrados: 0 },
      },
    },
  };

  expect(revisar(contenido, MUNDO).errores).toEqual([
    'mundo.planos.a_la_nada.mira: "sillon" no es un personaje, ni un punto del mapa, ni un objeto del decorado con id',
  ]);
});

test('la zona que hace empezar una cinemática debe existir en el mapa', () => {
  const contenido: Contenido = {
    ...CONTENIDO,
    cinematicas: {
      bienvenida: {
        inicio: { tipo: 'zona', zona: 'entrada' },
        condicion: { tipo: 'objetivosCompletos' },
        saltable: true,
        guion: { tipo: 'pasos', pasos: [] },
      },
      paseo: {
        inicio: { tipo: 'zona', zona: 'plaza' },
        condicion: { tipo: 'objetivosCompletos' },
        saltable: true,
        guion: { tipo: 'pasos', pasos: [] },
      },
    },
  };

  expect(revisar(contenido, MUNDO).errores).toEqual([
    'cinematicas.paseo.inicia: no hay una zona llamada "plaza" en el mapa',
  ]);
});
