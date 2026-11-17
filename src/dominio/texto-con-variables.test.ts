import { expect, test } from 'bun:test';
import { conCambios, crearEstadoDeNivel } from './estado.ts';
import { completarTexto, variablesDesconocidasEn } from './texto-con-variables.ts';

const ESTADO_INICIAL = crearEstadoDeNivel({
  objetivos: ['tortillas', 'aguacates', 'limones'],
  variables: [],
  lista: { tortillas: 'las tortillas', aguacates: 'los aguacates', limones: 'los limones' },
  dinero: 100,
});

test('{faltan} con varios objetivos pendientes los une con comas y una «y» al final', () => {
  const texto = completarTexto('Te faltan {faltan}.', ESTADO_INICIAL);

  expect(texto).toBe('Te faltan las tortillas, los aguacates y los limones.');
});

test('{faltan} con dos objetivos pendientes los une solo con «y»', () => {
  const estado = conCambios(ESTADO_INICIAL, { tortillas: true });

  expect(completarTexto('Te faltan {faltan}.', estado)).toBe('Te faltan los aguacates y los limones.');
});

test('{faltan} con un objetivo pendiente lo nombra solo', () => {
  const estado = conCambios(ESTADO_INICIAL, { tortillas: true, limones: true });

  expect(completarTexto('Te faltan {faltan}.', estado)).toBe('Te faltan los aguacates.');
});

test('{faltan} queda vacío cuando ya no falta nada', () => {
  const estado = conCambios(ESTADO_INICIAL, { tortillas: true, aguacates: true, limones: true });

  expect(completarTexto('Te faltan {faltan}.', estado)).toBe('Te faltan .');
});

test('un objetivo que no está en la lista se nombra tal cual', () => {
  const estado = crearEstadoDeNivel({ objetivos: ['tortillas'], variables: [], lista: {} });

  expect(completarTexto('Te faltan {faltan}.', estado)).toBe('Te faltan tortillas.');
});

test('{dinero} muestra el dinero actual', () => {
  const estado = conCambios(ESTADO_INICIAL, { dinero: 35 });

  expect(completarTexto('Tienes {dinero} pesos.', estado)).toBe('Tienes 35 pesos.');
});

test('{dinero} vale 0 si el nivel no usa dinero', () => {
  const estado = crearEstadoDeNivel({ objetivos: [], variables: [], lista: {} });

  expect(completarTexto('Tienes {dinero} pesos.', estado)).toBe('Tienes 0 pesos.');
});

test('un texto sin llaves queda igual', () => {
  expect(completarTexto('¡Hola!', ESTADO_INICIAL)).toBe('¡Hola!');
});

test('detecta los nombres entre llaves que no existen', () => {
  expect(variablesDesconocidasEn('Te faltan {falta} y tienes {dinero}.')).toEqual(['falta']);
  expect(variablesDesconocidasEn('Te faltan {faltan}.')).toEqual([]);
  expect(variablesDesconocidasEn('¡Hola!')).toEqual([]);
});
