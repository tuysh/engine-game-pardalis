import { expect, test } from 'bun:test';
import { crearDiagnostico } from './diagnostico.ts';
import type { Paso } from './paso.ts';
import { revisarCiclosDeSecuencias } from './revisar-ciclos-de-secuencias.ts';

function llamarA(nombre: string): Paso {
  return { tipo: 'secuencia', nombre };
}

test('secuencias que se llaman sin volver atrás no son un ciclo', () => {
  const diagnostico = crearDiagnostico();

  revisarCiclosDeSecuencias({ a: [llamarA('b'), llamarA('c')], b: [llamarA('c')], c: [] }, diagnostico);

  expect(diagnostico.errores).toEqual([]);
});

test('dos secuencias que se llaman entre sí son un ciclo, y se reporta una sola vez', () => {
  const diagnostico = crearDiagnostico();

  revisarCiclosDeSecuencias({ a: [llamarA('b')], b: [llamarA('a')] }, diagnostico);

  expect(diagnostico.errores).toEqual(['ciclo entre secuencias: a → b → a']);
});

test('una secuencia que se llama a sí misma es un ciclo', () => {
  const diagnostico = crearDiagnostico();

  revisarCiclosDeSecuencias({ a: [llamarA('a')] }, diagnostico);

  expect(diagnostico.errores).toEqual(['ciclo entre secuencias: a → a']);
});

test('encuentra el ciclo aunque la llamada esté dentro de un condicional o de una opción', () => {
  const diagnostico = crearDiagnostico();
  const dentroDeUnCondicional: Paso = {
    tipo: 'condicional',
    condicion: { tipo: 'objetivosCompletos' },
    pasos: [llamarA('b')],
  };
  const dentroDeUnaOpcion: Paso = {
    tipo: 'elige',
    pregunta: '¿Otra vez?',
    opciones: [{ imagen: 'img_si', alElegir: { tipo: 'secuencia', nombre: 'a' } }],
  };

  revisarCiclosDeSecuencias({ a: [dentroDeUnCondicional], b: [dentroDeUnaOpcion] }, diagnostico);

  expect(diagnostico.errores).toEqual(['ciclo entre secuencias: a → b → a']);
});

test('una llamada a una secuencia que no existe no se reporta aquí', () => {
  const diagnostico = crearDiagnostico();

  revisarCiclosDeSecuencias({ a: [llamarA('no_existe')] }, diagnostico);

  expect(diagnostico.errores).toEqual([]);
});
