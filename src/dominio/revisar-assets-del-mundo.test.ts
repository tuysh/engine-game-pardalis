import { expect, test } from 'bun:test';
import type { AssetsDeNivel } from './assets-de-nivel.ts';
import { crearDiagnostico } from './diagnostico.ts';
import type { Mundo } from './mundo.ts';
import { revisarAssetsDelMundo } from './revisar-assets-del-mundo.ts';

const ASSETS: AssetsDeNivel = {
  suelo_barrio: { carpeta: '.', asset: { tipo: 'imagen', archivo: 'img/suelo.svg', anchoEnPixeles: 1000, altoEnPixeles: 600 } },
  vo_hola: { carpeta: '.', asset: { tipo: 'audio', archivo: 'voz/vo_hola.mp3' } },
};

const MUNDO: Mundo = {
  anchoEnMetros: 10,
  profundidadEnMetros: 6,
  suelo: { asset: 'suelo_barrio', esquina: { x: 0, y: 0 } },
  telones: [
    { descripcion: 'objeto #1', asset: 'telon_fachadas', desde: { x: 0, y: 1 }, hasta: { x: 10, y: 1 }, altoEnMetros: 4 },
  ],
  decorado: [
    {
      descripcion: 'objeto #2 "Puesto"',
      clase: 'parado',
      asset: 'vo_hola',
      huella: { x: 3, y: 2, ancho: 3, alto: 1 },
      alturaEnMetros: 0,
    },
  ],
  npcs: {},
  iniciosDelJugador: [],
  puntos: {},
  zonas: {},
  pisos: [],
};

test('cada imagen del mapa que falta o es de otro tipo se reporta nombrando su capa u objeto', () => {
  const diagnostico = crearDiagnostico();

  revisarAssetsDelMundo(MUNDO, ASSETS, diagnostico);

  expect(diagnostico.errores).toEqual([
    'mapa: objeto #1 (telón): no existe la imagen "telon_fachadas" en los assets del nivel',
    'mapa: objeto #2 "Puesto" (decorado): "vo_hola" es un asset de tipo audio, y aquí va una imagen',
  ]);
});

test('si falta la imagen del suelo, se nombra la capa', () => {
  const diagnostico = crearDiagnostico();
  const mundo: Mundo = { ...MUNDO, suelo: { asset: 'suelo_casa', esquina: { x: 0, y: 0 } }, telones: [], decorado: [] };

  revisarAssetsDelMundo(mundo, ASSETS, diagnostico);

  expect(diagnostico.errores).toEqual(['mapa: la capa "suelo": no existe la imagen "suelo_casa" en los assets del nivel']);
});

test('un mapa sin suelo, telones ni decorado no tiene nada que revisar', () => {
  const diagnostico = crearDiagnostico();
  const mundo: Mundo = { ...MUNDO, suelo: undefined, telones: [], decorado: [] };

  revisarAssetsDelMundo(mundo, ASSETS, diagnostico);

  expect(diagnostico).toEqual({ errores: [], advertencias: [] });
});
