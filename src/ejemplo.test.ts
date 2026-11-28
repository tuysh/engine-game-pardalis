// Comprueba que los niveles de ejemplo del repositorio pasan la validación, por la misma entrada pública que usa CI.
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

test('las únicas advertencias del barrio son por voces que todavía no se graban', async () => {
  const rutaDelNivel = `${CARPETA_DE_NIVELES}barrio/nivel.json`;

  const resultado = await validarNivel(rutaDelNivel, { minijuegos: ['Tortilleria'] });

  expect(resultado.advertencias).toHaveLength(8);
  for (const advertencia of resultado.advertencias) {
    expect(advertencia).toEndWith('; se usará voz sintetizada');
  }
});

test('el nivel de ejemplo "casa" es válido: no tiene jugador y su cinemática de entrada sale al barrio', async () => {
  const rutaDelNivel = `${CARPETA_DE_NIVELES}casa/nivel.json`;

  const resultado = await validarNivel(rutaDelNivel, {});

  expect(resultado.errores).toEqual([]);
  expect(resultado.nivel?.contenido.jugador).toBeUndefined();
  expect(resultado.nivel?.contenido.cinematicas['intro']?.inicio).toEqual({ tipo: 'alEntrar' });
  // La tele y Tommy viendo la tele son animaciones: sus cuadros numerados se agruparon solos.
  expect(resultado.nivel?.assets['tele']?.asset.tipo).toBe('animacion');
  expect(resultado.nivel?.assets['tommy_viendo_tele']?.asset.tipo).toBe('animacion');
});

test('las únicas advertencias de la casa son por voces y sonidos que todavía no se graban', async () => {
  const rutaDelNivel = `${CARPETA_DE_NIVELES}casa/nivel.json`;

  const resultado = await validarNivel(rutaDelNivel, {});

  expect(resultado.advertencias).toEqual([
    'cinematicas.intro.pasos[3].juntos[1].sonido: no existe el audio "puerta_abre"; no sonará',
    'cinematicas.intro.pasos[8].audio: no existe la voz "vo_mama_tortillas"; se usará voz sintetizada',
    'cinematicas.intro.pasos[11].audio: no existe la voz "vo_tommy_si"; se usará voz sintetizada',
  ]);
});
