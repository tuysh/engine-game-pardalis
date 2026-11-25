import { expect, test } from 'bun:test';
import type { DeclaracionDeEstado } from '../dominio/estado.ts';
import type { Partida } from '../dominio/partida.ts';
import { PartidaEnCurso } from './partida-en-curso.ts';

const SIN_COMPARTIDAS: DeclaracionDeEstado = { objetivos: [], variables: [], lista: {} };
const PARTIDA_DEL_HOST: Partida = { v: 1, nivel: 'barrio', niveles: { barrio: { estado: { globo: 'rosa' } } } };

test('una partida nueva solo trae el nivel que se está jugando', () => {
  const partida = new PartidaEnCurso(undefined);

  expect(partida.leerJugando('casa', { propias: { 'vista.intro': true }, compartidas: {} })).toEqual({
    v: 1,
    nivel: 'casa',
    niveles: { casa: { estado: { 'vista.intro': true } } },
  });
});

test('las variables de un nivel son las de la partida del host, o ninguna si nunca se visitó', () => {
  const partida = new PartidaEnCurso(PARTIDA_DEL_HOST);

  expect(partida.variablesPara('barrio', SIN_COMPARTIDAS)).toEqual({ globo: 'rosa' });
  expect(partida.variablesPara('casa', SIN_COMPARTIDAS)).toEqual({});
  expect(new PartidaEnCurso(undefined).variablesPara('casa', SIN_COMPARTIDAS)).toBeUndefined();
});

test('el estado con el que se deja un nivel se conserva al jugar otro', () => {
  const partida = new PartidaEnCurso(undefined);

  partida.anotarNivel('casa', { propias: { 'vista.intro': true }, compartidas: {} });

  expect(partida.variablesPara('casa', SIN_COMPARTIDAS)).toEqual({ 'vista.intro': true });
  expect(partida.leerJugando('barrio', { propias: {}, compartidas: {} }).niveles).toEqual({
    casa: { estado: { 'vista.intro': true } },
    barrio: { estado: {} },
  });
});

test('mientras se sale hacia otro nivel, la partida ya dice que el jugador está allá', () => {
  const partida = new PartidaEnCurso(undefined);

  partida.salirHacia('barrio');
  expect(partida.leerJugando('casa', { propias: {}, compartidas: {} }).nivel).toBe('barrio');

  partida.olvidarLaSalida();
  expect(partida.leerJugando('casa', { propias: {}, compartidas: {} }).nivel).toBe('casa');
});

test('sin nivel en juego, la partida es la que se anotó al dejar el último: no pierde su estado', () => {
  const partida = new PartidaEnCurso(undefined);
  partida.anotarNivel('barrio', { propias: { tortillas: true }, compartidas: {} });

  expect(partida.leerSinNivelEnJuego('barrio')).toEqual({
    v: 1,
    nivel: 'barrio',
    niveles: { barrio: { estado: { tortillas: true } } },
  });
});

test('sin nivel en juego y sin nada anotado, la partida nombra al último nivel con su estado vacío', () => {
  const partida = new PartidaEnCurso(undefined);

  expect(partida.leerSinNivelEnJuego('casa')).toEqual({ v: 1, nivel: 'casa', niveles: { casa: { estado: {} } } });
});

test('si se dejó un nivel saliendo hacia otro y ninguno logró empezar, la partida sigue nombrando el destino', () => {
  const partida = new PartidaEnCurso(undefined);
  partida.salirHacia('barrio');
  partida.anotarNivel('casa', { propias: { 'vista.intro': true }, compartidas: {} });

  // El barrio no cargó y tampoco se pudo volver a la casa: ya no se está saliendo, y no hay nivel en juego.
  partida.olvidarLaSalida();

  expect(partida.leerSinNivelEnJuego('casa')).toEqual({
    v: 1,
    nivel: 'barrio',
    niveles: { casa: { estado: { 'vista.intro': true } } },
  });
});

test('si el destino no cargó pero se volvió al nivel anterior, la partida nombra el nivel que se juega', () => {
  const partida = new PartidaEnCurso(undefined);
  partida.salirHacia('barrio');
  partida.anotarNivel('casa', { propias: { 'vista.intro': true }, compartidas: {} });
  partida.olvidarLaSalida();

  expect(partida.leerJugando('casa', { propias: { 'vista.intro': true }, compartidas: {} }).nivel).toBe('casa');
});

test('lo que un nivel comparte se guarda aparte y le llega a otro nivel que también lo declara', () => {
  const partida = new PartidaEnCurso(undefined);
  const comedor: DeclaracionDeEstado = { objetivos: [], variables: [], lista: {}, compartidas: ['flor'] };

  partida.anotarNivel('mercado', { propias: { 'charlas.florista': true }, compartidas: { flor: true, estrellas: 3 } });

  expect(partida.leerJugando('comedor', { propias: {}, compartidas: {} })).toEqual({
    v: 1,
    nivel: 'comedor',
    niveles: { mercado: { estado: { 'charlas.florista': true } }, comedor: { estado: {} } },
    compartidas: { flor: true, estrellas: 3 },
  });
  // Al comedor solo le llega lo que declara: `estrellas` no.
  expect(partida.variablesPara('comedor', comedor)).toEqual({ flor: true });
  expect(partida.variablesPara('comedor', SIN_COMPARTIDAS)).toEqual({});
});
