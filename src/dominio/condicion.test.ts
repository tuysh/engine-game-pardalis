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

test('una comparación se lee con su variable, su signo y su número, con o sin espacios y con "tengo"', () => {
  const esperada: Condicion = { tipo: 'comparacion', nombre: 'dinero', operador: '>=', numero: 10 };

  expect(leerCondicionDeTexto('dinero >= 10')).toEqual(esperada);
  expect(leerCondicionDeTexto('dinero>=10')).toEqual(esperada);
  expect(leerCondicionDeTexto('tengo dinero >= 10')).toEqual(esperada);
  expect(leerCondicionDeTexto('estrellas = 3')).toEqual({ tipo: 'comparacion', nombre: 'estrellas', operador: '=', numero: 3 });
  expect(leerCondicionDeTexto('no dinero < 2.5')).toEqual({
    tipo: 'no',
    condicion: { tipo: 'comparacion', nombre: 'dinero', operador: '<', numero: 2.5 },
  });
});

test('una comparación se cumple según el número de la variable', () => {
  const conDiezPesos = conCambios(ESTADO_INICIAL, { dinero: 10 });

  expect(cumpleCondicion(leerCondicionDeTexto('dinero >= 10'), conDiezPesos)).toBe(true);
  expect(cumpleCondicion(leerCondicionDeTexto('dinero > 10'), conDiezPesos)).toBe(false);
  expect(cumpleCondicion(leerCondicionDeTexto('dinero <= 10'), conDiezPesos)).toBe(true);
  expect(cumpleCondicion(leerCondicionDeTexto('dinero < 10'), conDiezPesos)).toBe(false);
  expect(cumpleCondicion(leerCondicionDeTexto('dinero = 10'), conDiezPesos)).toBe(true);
});

test('en una comparación, una variable sin valor cuenta como cero', () => {
  expect(cumpleCondicion(leerCondicionDeTexto('estrellas < 1'), ESTADO_INICIAL)).toBe(true);
  expect(cumpleCondicion(leerCondicionDeTexto('estrellas >= 1'), ESTADO_INICIAL)).toBe(false);
});

test('una comparación usa la variable que nombra', () => {
  expect(variablesQueUsa(leerCondicionDeTexto('dinero >= 10'))).toEqual(['dinero']);
});

test('con un texto a la derecha, "=" pregunta si la variable guarda justo ese texto', () => {
  expect(leerCondicionDeTexto('premio = pizarron')).toEqual({ tipo: 'textoIgual', nombre: 'premio', texto: 'pizarron' });
  expect(leerCondicionDeTexto('tengo premio=pizarron')).toEqual({
    tipo: 'textoIgual',
    nombre: 'premio',
    texto: 'pizarron',
  });
  expect(leerCondicionDeTexto('globo = rosa  claro')).toEqual({ tipo: 'textoIgual', nombre: 'globo', texto: 'rosa claro' });
});

test('una igualdad de texto se cumple solo con el mismo texto, tal cual', () => {
  const conPizarron = conCambios(ESTADO_INICIAL, { premio: 'pizarron' });
  const condicion = leerCondicionDeTexto('premio = pizarron');

  expect(cumpleCondicion(condicion, conPizarron)).toBe(true);
  expect(cumpleCondicion(leerCondicionDeTexto('premio = globo'), conPizarron)).toBe(false);
  expect(cumpleCondicion(leerCondicionDeTexto('premio = Pizarron'), conPizarron)).toBe(false);
  expect(cumpleCondicion(condicion, ESTADO_INICIAL)).toBe(false);
  expect(cumpleCondicion(leerCondicionDeTexto('no premio = pizarron'), ESTADO_INICIAL)).toBe(true);
});

test('con un número a la derecha, "=" sigue comparando números aunque se escriba sin espacios', () => {
  expect(leerCondicionDeTexto('estrellas=3')).toEqual({ tipo: 'comparacion', nombre: 'estrellas', operador: '=', numero: 3 });
});

test('un texto a la derecha de >=, <=, > o < no es una comparación: queda como un nombre para que la validación avise', () => {
  expect(leerCondicionDeTexto('globo >= mucho')).toEqual({ tipo: 'variable', nombre: 'globo >= mucho' });
  expect(leerCondicionDeTexto('premio == globo')).toEqual({ tipo: 'variable', nombre: 'premio == globo' });
});

test('una igualdad de texto usa la variable que nombra', () => {
  expect(variablesQueUsa(leerCondicionDeTexto('premio = pizarron'))).toEqual(['premio']);
});
