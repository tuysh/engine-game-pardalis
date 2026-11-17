import { expect, test } from 'bun:test';
import { unirManifiestos } from './assets-de-nivel.ts';
import { crearDiagnostico } from './diagnostico.ts';
import type { Asset } from './manifiesto.ts';

const TOMMY_DEL_NIVEL: Asset = { tipo: 'imagen', archivo: 'img/spr_tommy.svg', anchoEnPixeles: 90, altoEnPixeles: 160 };
const TOMMY_COMUN: Asset = { tipo: 'imagen', archivo: 'personajes/spr_tommy.svg', anchoEnPixeles: 80, altoEnPixeles: 150 };
const VOZ: Asset = { tipo: 'audio', archivo: 'voz/vo_hola.mp3' };

test('une los assets de todas las carpetas y recuerda de cuál salió cada uno', () => {
  const diagnostico = crearDiagnostico();

  const assets = unirManifiestos(
    [
      { carpeta: '.', manifiesto: { vo_hola: VOZ } },
      { carpeta: '../comun', manifiesto: { spr_tommy: TOMMY_COMUN } },
    ],
    diagnostico,
  );

  expect(assets).toEqual({
    vo_hola: { asset: VOZ, carpeta: '.' },
    spr_tommy: { asset: TOMMY_COMUN, carpeta: '../comun' },
  });
  expect(diagnostico).toEqual({ errores: [], advertencias: [] });
});

test('si una clave está en dos carpetas, gana la primera de la lista y se advierte', () => {
  const diagnostico = crearDiagnostico();

  const assets = unirManifiestos(
    [
      { carpeta: '.', manifiesto: { spr_tommy: TOMMY_DEL_NIVEL } },
      { carpeta: '../comun', manifiesto: { spr_tommy: TOMMY_COMUN } },
    ],
    diagnostico,
  );

  expect(assets).toEqual({ spr_tommy: { asset: TOMMY_DEL_NIVEL, carpeta: '.' } });
  expect(diagnostico.errores).toEqual([]);
  expect(diagnostico.advertencias).toEqual([
    'el asset "spr_tommy" está en las carpetas "." y "../comun"; se usa el de "."',
  ]);
});

test('sin carpetas no hay assets', () => {
  expect(unirManifiestos([], crearDiagnostico())).toEqual({});
});
