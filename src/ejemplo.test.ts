// Comprueba que el nivel de ejemplo del repositorio pasa la validación, con los adaptadores de verdad.
// Si esta prueba falla después de cambiar el formato de los niveles, hay que actualizar `ejemplo/` y docs/NIVELES.md.

import { expect, test } from 'bun:test';
import { CargadorDeArchivos } from './adaptadores/archivos/cargador-de-archivos.ts';
import { LectorDeNivelesDeJson } from './adaptadores/json/lector-de-niveles-de-json.ts';
import { validarNivel } from './aplicacion/validar-nivel.ts';

const CARPETA_DE_NIVELES = new URL('../ejemplo/niveles/', import.meta.url).pathname;

test('el nivel de ejemplo "barrio" es válido, sin errores ni advertencias', async () => {
  const puertos = { cargador: new CargadorDeArchivos(), lector: new LectorDeNivelesDeJson() };
  const pedido = { direccionDelNivel: `${CARPETA_DE_NIVELES}barrio/nivel.json`, minijuegos: ['Tortilleria'] };

  const resultado = await validarNivel(pedido, puertos);

  expect(resultado.errores).toEqual([]);
  expect(resultado.advertencias).toEqual([]);
  expect(resultado.nivel?.contenido.meta.id).toBe('barrio');
});
