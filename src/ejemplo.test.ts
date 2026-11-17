// Comprueba que el nivel de ejemplo del repositorio pasa la validación, por la misma entrada pública que usa CI.
// Si esta prueba falla después de cambiar el formato de los niveles, hay que actualizar `ejemplo/` y docs/NIVELES.md.

import { expect, test } from 'bun:test';
import { validarNivel } from './validar.ts';

const CARPETA_DE_NIVELES = new URL('../ejemplo/niveles/', import.meta.url).pathname;

test('el nivel de ejemplo "barrio" es válido, sin errores ni advertencias', async () => {
  const rutaDelNivel = `${CARPETA_DE_NIVELES}barrio/nivel.json`;

  const resultado = await validarNivel(rutaDelNivel, { minijuegos: ['Tortilleria'] });

  expect(resultado.errores).toEqual([]);
  expect(resultado.advertencias).toEqual([]);
  expect(resultado.nivel?.contenido.meta.id).toBe('barrio');
});
