import { expect, test } from 'bun:test';
import { elegirVoz, etiquetaDeIdioma } from './elegir-voz.ts';

test('para español prefiere la voz de México, luego otra de América y luego cualquier español', () => {
  const espana = { lang: 'es-ES', name: 'Mónica', default: false };
  const estadosUnidos = { lang: 'es-US', name: 'Paulina US', default: false };
  const mexico = { lang: 'es-MX', name: 'Paulina', default: false };
  const ingles = { lang: 'en-US', name: 'Samantha', default: false };

  expect(elegirVoz([ingles, espana, estadosUnidos, mexico], 'es')).toBe(mexico);
  expect(elegirVoz([ingles, espana, estadosUnidos], 'es')).toBe(estadosUnidos);
  expect(elegirVoz([ingles, espana], 'es')).toBe(espana);
});

test('para inglés prefiere la voz de Estados Unidos y, si no hay, cualquier inglés', () => {
  const britanica = { lang: 'en-GB', name: 'Daniel', default: false };
  const estadounidense = { lang: 'en-US', name: 'Samantha', default: false };

  expect(elegirVoz([britanica, estadounidense], 'en')).toBe(estadounidense);
  expect(elegirVoz([britanica], 'en')).toBe(britanica);
});

test('entiende las etiquetas de Android con guion bajo y sin región, y no confunde idiomas', () => {
  const android = { lang: 'es_MX', name: 'es-mx-x-sfb-local', default: false };
  const sinRegion = { lang: 'en', name: 'English', default: false };
  const estonio = { lang: 'et-EE', name: 'Estonian', default: false };

  expect(elegirVoz([sinRegion, android], 'es')).toBe(android);
  expect(elegirVoz([estonio, sinRegion], 'en')).toBe(sinRegion);
  expect(elegirVoz([estonio], 'es')).toBeUndefined();
  expect(elegirVoz([], 'en')).toBeUndefined();
});

test('descarta las voces de broma de Apple aunque sean de Estados Unidos', () => {
  const burbujas = { lang: 'en-US', name: 'Bubbles', default: false };
  const albert = { lang: 'en-US', name: 'Albert', default: false };
  const samantha = { lang: 'en-US', name: 'Samantha', default: false };
  const britanica = { lang: 'en-GB', name: 'Daniel', default: false };

  expect(elegirVoz([albert, burbujas, samantha], 'en')).toBe(samantha);
  expect(elegirVoz([albert, burbujas, britanica], 'en')).toBe(britanica);
  expect(elegirVoz([albert, burbujas], 'en')).toBeUndefined();
});

test('entre voces de la misma región gana la del dispositivo por omisión, pero la región pesa más', () => {
  const juan = { lang: 'es-MX', name: 'Juan', default: false };
  const paulina = { lang: 'es-MX', name: 'Paulina', default: true };
  const espanaPorOmision = { lang: 'es-ES', name: 'Mónica', default: true };

  expect(elegirVoz([juan, paulina], 'es')).toBe(paulina);
  expect(elegirVoz([espanaPorOmision, juan], 'es')).toBe(juan);
});

test('una voz natural gana a una robótica de Apple de la misma región, aunque esa sea la de por omisión', () => {
  const eddy = { lang: 'es-MX', name: 'Eddy (Spanish (Mexico))', default: true };
  const grandma = { lang: 'es-MX', name: 'Grandma (Spanish (Mexico))', default: false };
  const paulina = { lang: 'es_MX', name: 'Paulina', default: false };
  const espana = { lang: 'es-ES', name: 'Mónica', default: false };

  expect(elegirVoz([eddy, grandma, paulina], 'es')).toBe(paulina);
  // La región sigue pesando más: una robótica de México gana a una natural de España.
  expect(elegirVoz([espana, eddy], 'es')).toBe(eddy);
});

test('la etiqueta de idioma de una voz de Android se escribe con guion', () => {
  expect(etiquetaDeIdioma({ lang: 'es_MX', name: 'es-mx-x-sfb-local', default: false })).toBe('es-MX');
  expect(etiquetaDeIdioma({ lang: 'en-US', name: 'Samantha', default: false })).toBe('en-US');
});
