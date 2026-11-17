import { expect, test } from 'bun:test';
import { interpretarComando } from './interpretar-comando.ts';

test('"validar" con una ruta pide validar ese nivel', () => {
  const comando = interpretarComando(['validar', 'niveles/casa/nivel.json']);

  expect(comando).toEqual({
    tipo: 'validar',
    rutaDelNivel: 'niveles/casa/nivel.json',
    minijuegos: undefined,
    cinematicas: undefined,
  });
});

test('"validar" con --minijuegos lleva la lista separada por comas', () => {
  const comando = interpretarComando(['validar', 'nivel.json', '--minijuegos', 'Tortilleria,Fruteria']);

  expect(comando).toMatchObject({
    tipo: 'validar',
    rutaDelNivel: 'nivel.json',
    minijuegos: ['Tortilleria', 'Fruteria'],
  });
});

test('--minijuegos puede ir antes de la ruta', () => {
  const comando = interpretarComando(['validar', '--minijuegos', 'Tortilleria', 'nivel.json']);

  expect(comando).toMatchObject({ tipo: 'validar', rutaDelNivel: 'nivel.json', minijuegos: ['Tortilleria'] });
});

test('--minijuegos sin lista explica cómo se escribe', () => {
  const comando = interpretarComando(['validar', 'nivel.json', '--minijuegos']);

  expect(comando).toEqual({
    tipo: 'invalido',
    mensaje: 'falta la lista de minijuegos: --minijuegos Tortilleria,Fruteria',
  });
});

test('"assets" con una carpeta pide generar su manifiesto', () => {
  const comando = interpretarComando(['assets', 'niveles/casa']);

  expect(comando).toEqual({ tipo: 'assets', carpeta: 'niveles/casa' });
});

test('sin argumentos se muestra la ayuda', () => {
  expect(interpretarComando([])).toEqual({ tipo: 'ayuda' });
});

test('"ayuda", "--help" y "-h" muestran la ayuda', () => {
  expect(interpretarComando(['ayuda'])).toEqual({ tipo: 'ayuda' });
  expect(interpretarComando(['--help'])).toEqual({ tipo: 'ayuda' });
  expect(interpretarComando(['-h'])).toEqual({ tipo: 'ayuda' });
});

test('"validar" sin ruta explica qué falta y cómo se escribe', () => {
  const comando = interpretarComando(['validar']);

  expect(comando).toEqual({
    tipo: 'invalido',
    mensaje: 'falta la ruta del nivel: escenario-engine validar <nivel.json>',
  });
});

test('"assets" sin carpeta explica qué falta y cómo se escribe', () => {
  const comando = interpretarComando(['assets']);

  expect(comando).toEqual({
    tipo: 'invalido',
    mensaje: 'falta la carpeta: escenario-engine assets <carpeta>',
  });
});

test('un comando que no existe se nombra en el mensaje', () => {
  const comando = interpretarComando(['bailar']);

  expect(comando).toEqual({ tipo: 'invalido', mensaje: 'no existe el comando "bailar"' });
});

test('"validar" con --cinematicas lleva su lista, sola o junto con --minijuegos', () => {
  const argumentos = ['validar', '--cinematicas', 'intro,final', 'nivel.json', '--minijuegos', 'Tortilleria'];
  const comando = interpretarComando(argumentos);

  expect(comando).toEqual({
    tipo: 'validar',
    rutaDelNivel: 'nivel.json',
    minijuegos: ['Tortilleria'],
    cinematicas: ['intro', 'final'],
  });
});

test('--cinematicas sin lista explica cómo se escribe', () => {
  const comando = interpretarComando(['validar', 'nivel.json', '--cinematicas']);

  expect(comando).toEqual({ tipo: 'invalido', mensaje: 'falta la lista de cinemáticas: --cinematicas intro,final' });
});
