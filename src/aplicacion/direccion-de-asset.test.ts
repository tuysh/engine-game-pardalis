import { expect, test } from 'bun:test';
import { CargadorDeMemoria } from '../adaptadores/memoria/cargador-de-memoria.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { buscarCuadrosDeAsset, direccionDeArchivoDeAssets } from './direccion-de-asset.ts';

const CARGADOR = new CargadorDeMemoria({});

test('sin raíz, los assets se buscan junto a nivel.json', () => {
  const ubicacion = { direccionDelNivel: '/niveles/barrio/nivel.json', cargador: CARGADOR };

  expect(direccionDeArchivoDeAssets('.', 'img/spr_tortu.svg', ubicacion)).toBe('/niveles/barrio/img/spr_tortu.svg');
  expect(direccionDeArchivoDeAssets('../comun', 'assets.json', ubicacion)).toBe('/niveles/comun/assets.json');
});

test('con raíz, la raíz ocupa el lugar de la carpeta de los niveles', () => {
  const ubicacion = {
    direccionDelNivel: '/niveles/barrio/nivel.json',
    raizDeAssets: 'https://assets.pardalis.mx/aventura/',
    cargador: CARGADOR,
  };

  expect(direccionDeArchivoDeAssets('.', 'img/spr_tortu.svg', ubicacion)).toBe(
    'https://assets.pardalis.mx/aventura/barrio/img/spr_tortu.svg',
  );
  expect(direccionDeArchivoDeAssets('../comun', 'assets.json', ubicacion)).toBe(
    'https://assets.pardalis.mx/aventura/comun/assets.json',
  );
});

test('la raíz funciona igual si se escribe sin la barra final', () => {
  const ubicacion = {
    direccionDelNivel: '/niveles/barrio/nivel.json',
    raizDeAssets: 'https://assets.pardalis.mx/aventura',
    cargador: CARGADOR,
  };

  expect(direccionDeArchivoDeAssets('.', 'assets.json', ubicacion)).toBe(
    'https://assets.pardalis.mx/aventura/barrio/assets.json',
  );
});

test('con raíz, una carpeta de assets que se sale de ella es un error que explica la regla', () => {
  const ubicacion = {
    direccionDelNivel: '/niveles/barrio/nivel.json',
    raizDeAssets: 'https://assets.pardalis.mx/aventura/',
    cargador: CARGADOR,
  };

  expect(() => direccionDeArchivoDeAssets('../../otro', 'a.svg', ubicacion)).toThrow(ErrorDeEscenario);
});

test('los cuadros de una animación salen en el orden de su secuencia, con su ritmo; de una imagen, uno solo', () => {
  const ubicacion = { direccionDelNivel: '/niveles/barrio/nivel.json', cargador: CARGADOR };
  const assets = {
    spr_tepo: {
      carpeta: '.',
      asset: {
        tipo: 'animacion' as const,
        cuadros: ['img/spr_tepo_1.svg', 'img/spr_tepo_1.svg', 'img/spr_tepo_2.svg'],
        cuadrosPorSegundo: 4,
        anchoEnPixeles: 100,
        altoEnPixeles: 160,
      },
    },
    comal: {
      carpeta: '../comun',
      asset: { tipo: 'imagen' as const, archivo: 'img/comal.svg', anchoEnPixeles: 90, altoEnPixeles: 80 },
    },
    sfx_ding: { carpeta: '.', asset: { tipo: 'audio' as const, archivo: 'audio/sfx_ding.mp3' } },
  };

  expect(buscarCuadrosDeAsset('spr_tepo', assets, ubicacion)).toEqual({
    urls: [
      '/niveles/barrio/img/spr_tepo_1.svg',
      '/niveles/barrio/img/spr_tepo_1.svg',
      '/niveles/barrio/img/spr_tepo_2.svg',
    ],
    cuadrosPorSegundo: 4,
  });
  expect(buscarCuadrosDeAsset('comal', assets, ubicacion)).toEqual({
    urls: ['/niveles/comun/img/comal.svg'],
    cuadrosPorSegundo: 0,
  });
  expect(buscarCuadrosDeAsset('sfx_ding', assets, ubicacion)).toBeUndefined();
  expect(buscarCuadrosDeAsset('constructor', assets, ubicacion)).toBeUndefined();
});
