import { expect, test } from 'bun:test';
import { interpretarComando } from './interpretar-comando.ts';

test('"validar" con una ruta pide validar ese nivel', () => {
  const comando = interpretarComando(['validar', 'niveles/casa/nivel.json']);

  expect(comando).toEqual({ tipo: 'validar', rutaDelNivel: 'niveles/casa/nivel.json' });
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
