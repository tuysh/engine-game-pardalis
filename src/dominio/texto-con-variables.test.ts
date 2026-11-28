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
  const declaracion = ESTADO_INICIAL.declaracion;

  expect(variablesDesconocidasEn('Te faltan {falta} y tienes {dinero}.', declaracion)).toEqual(['falta']);
  expect(variablesDesconocidasEn('Te faltan {faltan}.', declaracion)).toEqual([]);
  expect(variablesDesconocidasEn('¡Hola!', declaracion)).toEqual([]);
});

const MERCADO = crearEstadoDeNivel({
  objetivos: ['verduras', 'maiz'],
  variables: ['compras'],
  compartidas: ['estrellas'],
  lista: { verduras: 'las verduras', maiz: 'el maíz' },
});

test('{falta_o_faltan} dice «falta» cuando lo único que falta es singular', () => {
  const estado = conCambios(MERCADO, { verduras: true });

  expect(completarTexto('Nos {falta_o_faltan} {faltan}.', estado)).toBe('Nos falta el maíz.');
});

test('{falta_o_faltan} dice «faltan» cuando lo único que falta es plural', () => {
  const estado = conCambios(MERCADO, { maiz: true });

  expect(completarTexto('Nos {falta_o_faltan} {faltan}.', estado)).toBe('Nos faltan las verduras.');
});

test('{falta_o_faltan} dice «faltan» con dos o más objetivos pendientes, aunque el primero sea singular', () => {
  const estado = crearEstadoDeNivel({
    objetivos: ['maiz', 'pan'],
    variables: [],
    lista: { maiz: 'el maíz', pan: 'el pan' },
  });

  expect(completarTexto('Nos {falta_o_faltan} {faltan}.', estado)).toBe('Nos faltan el maíz y el pan.');
});

test('{falta_o_faltan} dice «faltan» si el nombre no empieza con un artículo', () => {
  const estado = crearEstadoDeNivel({ objetivos: ['pan'], variables: [], lista: {} });

  expect(completarTexto('Te {falta_o_faltan} {faltan}.', estado)).toBe('Te faltan pan.');
});

test('{cuantos_faltan} cuenta los objetivos pendientes', () => {
  expect(completarTexto('Faltan {cuantos_faltan}.', MERCADO)).toBe('Faltan 2.');
  expect(completarTexto('Faltan {cuantos_faltan}.', conCambios(MERCADO, { verduras: true, maiz: true }))).toBe(
    'Faltan 0.',
  );
});

test('una variable de estado.variables o estado.compartidas se muestra con su número', () => {
  const estado = conCambios(MERCADO, { estrellas: 7, compras: 2 });

  expect(completarTexto('¡Juntamos {estrellas} estrellas en {compras} compras!', estado)).toBe(
    '¡Juntamos 7 estrellas en 2 compras!',
  );
});

test('una variable sin valor, o con un valor que no es número, se muestra como 0', () => {
  const conTexto = conCambios(MERCADO, { compras: 'muchas' });

  expect(completarTexto('{estrellas} y {compras}', conTexto)).toBe('0 y 0');
});

test('un nombre entre llaves que el nivel no declara queda tal cual', () => {
  const estado = conCambios(MERCADO, { verduras: true });

  expect(completarTexto('{verduras} y {nadie}', estado)).toBe('{verduras} y {nadie}');
});

test('un objetivo no se puede mostrar en un texto; una variable declarada sí', () => {
  expect(variablesDesconocidasEn('{maiz} {estrellas} {compras}', MERCADO.declaracion)).toEqual(['maiz']);
});
