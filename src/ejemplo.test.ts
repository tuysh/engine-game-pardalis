// Comprueba que el nivel de ejemplo del repositorio pasa la validación, por la misma entrada pública que usa CI.
// Si esta prueba falla después de cambiar el formato de los niveles, hay que actualizar `ejemplo/` y docs/NIVELES.md.

import { expect, test } from 'bun:test';
import { validarNivel } from './validar.ts';

const CARPETA_DE_NIVELES = new URL('../ejemplo/niveles/', import.meta.url).pathname;

test('el nivel de ejemplo "barrio" es válido', async () => {
  const rutaDelNivel = `${CARPETA_DE_NIVELES}barrio/nivel.json`;

  const resultado = await validarNivel(rutaDelNivel, { minijuegos: ['Tortilleria'] });

  expect(resultado.errores).toEqual([]);
  expect(resultado.nivel?.contenido.meta.id).toBe('barrio');
  // Sus figuras salen de dos carpetas: la del nivel y la común.
  expect(resultado.nivel?.assets['spr_tortu']?.carpeta).toBe('.');
  expect(resultado.nivel?.assets['spr_tommy']?.carpeta).toBe('../comun');
});

test('las únicas advertencias del ejemplo son por voces que todavía no se graban', async () => {
  const rutaDelNivel = `${CARPETA_DE_NIVELES}barrio/nivel.json`;

  const resultado = await validarNivel(rutaDelNivel, { minijuegos: ['Tortilleria'] });

  expect(resultado.advertencias).toHaveLength(6);
  for (const advertencia of resultado.advertencias) {
    expect(advertencia).toEndWith('; se usará voz sintetizada');
  }
});
