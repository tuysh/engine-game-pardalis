import { expect, test } from 'bun:test';
import { CargadorDeMemoria } from '../adaptadores/memoria/cargador-de-memoria.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { direccionDeArchivoDeAssets } from './direccion-de-asset.ts';

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
