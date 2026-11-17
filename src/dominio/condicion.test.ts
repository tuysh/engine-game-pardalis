import { expect, test } from 'bun:test';
import { cumpleCondicion, leerCondicionDeTexto, variablesQueUsa } from './condicion.ts';
import type { Condicion } from './condicion.ts';
import { conCambios, crearEstadoDeNivel } from './estado.ts';

const ESTADO_INICIAL = crearEstadoDeNivel({ objetivos: ['tortillas', 'aguacates'], variables: ['globo'], lista: {} });

test('"tengo tortillas" y "tortillas" significan lo mismo', () => {
  const esperada: Condicion = { tipo: 'variable', nombre: 'tortillas' };

  expect(leerCondicionDeTexto('tengo tortillas')).toEqual(esperada);
  expect(leerCondicionDeTexto('tortillas')).toEqual(esperada);
});

test('"no" delante niega cualquier condición', () => {
  expect(leerCondicionDeTexto('no tengo limones')).toEqual({
    tipo: 'no',
    condicion: { tipo: 'variable', nombre: 'limones' },
  });
  expect(leerCondicionDeTexto('no objetivosCompletos')).toEqual({
    tipo: 'no',
    condicion: { tipo: 'objetivosCompletos' },
  });
});

test('los espacios de más no cambian la condición', () => {
  expect(leerCondicionDeTexto('  no   tengo   limones ')).toEqual(leerCondicionDeTexto('no tengo limones'));
});

test('un nombre con punto, como "charlas.tortu", es una variable normal', () => {
  expect(leerCondicionDeTexto('charlas.tortu')).toEqual({ tipo: 'variable', nombre: 'charlas.tortu' });
});

test('una variable se cumple cuando tiene un valor verdadero', () => {
  const condicion = leerCondicionDeTexto('tengo tortillas');
  const conTortillas = conCambios(ESTADO_INICIAL, { tortillas: true });

  expect(cumpleCondicion(condicion, ESTADO_INICIAL)).toBe(false);
  expect(cumpleCondicion(condicion, conTortillas)).toBe(true);
});

test('la negación se cumple justo cuando la condición no', () => {
  const condicion = leerCondicionDeTexto('no tengo tortillas');
  const conTortillas = conCambios(ESTADO_INICIAL, { tortillas: true });

  expect(cumpleCondicion(condicion, ESTADO_INICIAL)).toBe(true);
  expect(cumpleCondicion(condicion, conTortillas)).toBe(false);
});

test('"objetivosCompletos" se cumple solo con todos los objetivos', () => {
  const condicion = leerCondicionDeTexto('objetivosCompletos');
  const conUno = conCambios(ESTADO_INICIAL, { tortillas: true });
  const conTodos = conCambios(conUno, { aguacates: true });

  expect(cumpleCondicion(condicion, conUno)).toBe(false);
  expect(cumpleCondicion(condicion, conTodos)).toBe(true);
});

test('"todas" pide que se cumplan todas sus partes', () => {
  const condicion: Condicion = {
    tipo: 'todas',
    condiciones: [leerCondicionDeTexto('tortillas'), leerCondicionDeTexto('globo')],
  };
  const conUna = conCambios(ESTADO_INICIAL, { tortillas: true });
  const conLasDos = conCambios(conUna, { globo: 'rosa' });

  expect(cumpleCondicion(condicion, conUna)).toBe(false);
  expect(cumpleCondicion(condicion, conLasDos)).toBe(true);
});

test('"alguna" se conforma con que se cumpla una de sus partes', () => {
  const condicion: Condicion = {
    tipo: 'alguna',
    condiciones: [leerCondicionDeTexto('tortillas'), leerCondicionDeTexto('globo')],
  };
  const conUna = conCambios(ESTADO_INICIAL, { globo: 'rosa' });

  expect(cumpleCondicion(condicion, ESTADO_INICIAL)).toBe(false);
  expect(cumpleCondicion(condicion, conUna)).toBe(true);
});

test('las variables que usa una condición incluyen las de sus partes y no "objetivosCompletos"', () => {
  const condicion: Condicion = {
    tipo: 'todas',
    condiciones: [
      leerCondicionDeTexto('no tengo limones'),
      leerCondicionDeTexto('objetivosCompletos'),
      { tipo: 'alguna', condiciones: [leerCondicionDeTexto('globo'), leerCondicionDeTexto('charlas.tortu')] },
    ],
  };

  expect(variablesQueUsa(condicion)).toEqual(['limones', 'globo', 'charlas.tortu']);
});
