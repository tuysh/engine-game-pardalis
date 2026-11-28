import { expect, test } from 'bun:test';
import { elegirVoz } from './elegir-voz.ts';

test('para español prefiere la voz de México, luego otra de América y luego cualquier español', () => {
  const espana = { lang: 'es-ES', name: 'Mónica' };
  const estadosUnidos = { lang: 'es-US', name: 'Paulina US' };
  const mexico = { lang: 'es-MX', name: 'Paulina' };
  const ingles = { lang: 'en-US', name: 'Samantha' };

  expect(elegirVoz([ingles, espana, estadosUnidos, mexico], 'es')).toBe(mexico);
  expect(elegirVoz([ingles, espana, estadosUnidos], 'es')).toBe(estadosUnidos);
  expect(elegirVoz([ingles, espana], 'es')).toBe(espana);
});

test('para inglés prefiere la voz de Estados Unidos y, si no hay, cualquier inglés', () => {
  const britanica = { lang: 'en-GB', name: 'Daniel' };
  const estadounidense = { lang: 'en-US', name: 'Samantha' };

  expect(elegirVoz([britanica, estadounidense], 'en')).toBe(estadounidense);
  expect(elegirVoz([britanica], 'en')).toBe(britanica);
});

test('entiende las etiquetas de Android con guion bajo y sin región, y no confunde idiomas', () => {
  const android = { lang: 'es_MX', name: 'es-mx-x-sfb-local' };
  const sinRegion = { lang: 'en', name: 'English' };
  const estonio = { lang: 'et-EE', name: 'Estonian' };

  expect(elegirVoz([sinRegion, android], 'es')).toBe(android);
  expect(elegirVoz([estonio, sinRegion], 'en')).toBe(sinRegion);
  expect(elegirVoz([estonio], 'es')).toBeUndefined();
  expect(elegirVoz([], 'en')).toBeUndefined();
});
