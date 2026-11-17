import { expect, test } from 'bun:test';
import { rutaDesdeLaRaizDeAssets } from './ruta-desde-la-raiz-de-assets.ts';

test('la carpeta "." es la del propio nivel', () => {
  const ruta = rutaDesdeLaRaizDeAssets('/niveles/barrio/nivel.json', '.', 'img/spr_tortu.svg');

  expect(ruta).toBe('barrio/img/spr_tortu.svg');
});

test('"../comun" es una carpeta hermana de la del nivel', () => {
  const ruta = rutaDesdeLaRaizDeAssets('https://sitio.mx/niveles/barrio/nivel.json', '../comun', 'img/spr_tommy.svg');

  expect(ruta).toBe('comun/img/spr_tommy.svg');
});

test('una subcarpeta del nivel queda dentro de la carpeta del nivel', () => {
  expect(rutaDesdeLaRaizDeAssets('/niveles/barrio/nivel.json', 'extras', 'assets.json')).toBe('barrio/extras/assets.json');
});

test('una carpeta que se sale de la raíz no tiene ruta', () => {
  expect(rutaDesdeLaRaizDeAssets('/niveles/barrio/nivel.json', '../../secreto', 'a.svg')).toBeUndefined();
});
