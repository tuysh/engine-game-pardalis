import { expect, test } from 'bun:test';
import { convertirEnErrorDeEscenario, describirError, ErrorDeEscenario } from './error-de-escenario.ts';

test('con un solo problema, el mensaje es ese problema con el prefijo del motor', () => {
  const error = new ErrorDeEscenario(['no se encontró el nivel "casa"']);

  expect(error.message).toBe('[escenario-engine] no se encontró el nivel "casa"');
  expect(error.problemas).toEqual(['no se encontró el nivel "casa"']);
});

test('con varios problemas, el mensaje los cuenta y los lista uno por línea', () => {
  const error = new ErrorDeEscenario(['falta el mapa', 'falta el contenido']);

  expect(error.message).toBe('[escenario-engine] 2 problemas:\n  - falta el mapa\n  - falta el contenido');
});

test('es un Error de verdad, para que el host lo pueda atrapar y reconocer', () => {
  const error = new ErrorDeEscenario(['algo falló']);

  expect(error).toBeInstanceOf(Error);
  expect(error).toBeInstanceOf(ErrorDeEscenario);
  expect(error.name).toBe('ErrorDeEscenario');
});

test('describir un error da su mensaje; lo que no es un Error se describe como texto', () => {
  expect(describirError(new Error('se cayó la red'))).toBe('se cayó la red');
  expect(describirError('texto suelto')).toBe('texto suelto');
  expect(describirError(404)).toBe('404');
});

test('convertir en error de escenario conserva uno que ya lo es, con todos sus problemas', () => {
  const original = new ErrorDeEscenario(['falta el mapa', 'falta el contenido']);

  expect(convertirEnErrorDeEscenario(original)).toBe(original);
});

test('convertir un error cualquiera lo deja como un error de escenario con un solo problema', () => {
  const convertido = convertirEnErrorDeEscenario(new Error('se rompió el comal'));

  expect(convertido).toBeInstanceOf(ErrorDeEscenario);
  expect(convertido.problemas).toEqual(['se rompió el comal']);
});
