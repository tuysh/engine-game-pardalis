import { expect, test } from 'bun:test';
import { esRutaSeguraDeAsset, extensionDe, nombreSinExtensionDe, tipoDeArchivoDeAsset } from './ruta-de-asset.ts';

test('una ruta relativa dentro de la carpeta es segura', () => {
  expect(esRutaSeguraDeAsset('spr_mama.svg')).toBe(true);
  expect(esRutaSeguraDeAsset('img/spr_mama.svg')).toBe(true);
  expect(esRutaSeguraDeAsset('voz/es/vo_hola.mp3')).toBe(true);
});

test('una ruta que sube de carpeta no es segura, tampoco escrita con %2e', () => {
  expect(esRutaSeguraDeAsset('../secreto.svg')).toBe(false);
  expect(esRutaSeguraDeAsset('img/../../secreto.svg')).toBe(false);
  expect(esRutaSeguraDeAsset('img\\..\\secreto.svg')).toBe(false);
  expect(esRutaSeguraDeAsset('%2e%2e/secreto.svg')).toBe(false);
});

test('una ruta que empieza en la raíz no es segura', () => {
  expect(esRutaSeguraDeAsset('/etc/passwd')).toBe(false);
  expect(esRutaSeguraDeAsset('\\servidor\\a.svg')).toBe(false);
});

test('una URL completa no es segura', () => {
  expect(esRutaSeguraDeAsset('https://otro-sitio.com/a.svg')).toBe(false);
  expect(esRutaSeguraDeAsset('data:image/svg+xml,<svg/>')).toBe(false);
  expect(esRutaSeguraDeAsset('//otro-sitio.com/a.svg')).toBe(false);
});

test('una ruta vacía no es segura', () => {
  expect(esRutaSeguraDeAsset('')).toBe(false);
  expect(esRutaSeguraDeAsset('   ')).toBe(false);
});

test('un % mal escrito no rompe la revisión', () => {
  expect(esRutaSeguraDeAsset('img/100%.svg')).toBe(true);
});

test('la extensión sale en minúsculas y con punto', () => {
  expect(extensionDe('img/spr_mama.svg')).toBe('.svg');
  expect(extensionDe('img/Foto.PNG')).toBe('.png');
  expect(extensionDe('img/sin_extension')).toBe('');
  expect(extensionDe('carpeta.con.puntos/archivo')).toBe('');
  expect(extensionDe('.oculto')).toBe('');
});

test('el nombre sin extensión no lleva carpetas', () => {
  expect(nombreSinExtensionDe('img/spr_mama.svg')).toBe('spr_mama');
  expect(nombreSinExtensionDe('tommy.viendo.tele_1.svg')).toBe('tommy.viendo.tele_1');
  expect(nombreSinExtensionDe('sin_extension')).toBe('sin_extension');
});

test('el tipo de un archivo sale de su extensión', () => {
  expect(tipoDeArchivoDeAsset('img/spr_mama.svg')).toBe('imagen');
  expect(tipoDeArchivoDeAsset('fondo.webp')).toBe('imagen');
  expect(tipoDeArchivoDeAsset('fondo.PNG')).toBe('imagen');
  expect(tipoDeArchivoDeAsset('voz/vo_hola.mp3')).toBe('audio');
  expect(tipoDeArchivoDeAsset('video/intro.mp4')).toBe('video');
});

test('un archivo que no es un asset no tiene tipo', () => {
  expect(tipoDeArchivoDeAsset('nivel.json')).toBeUndefined();
  expect(tipoDeArchivoDeAsset('mapa.tmj')).toBeUndefined();
  expect(tipoDeArchivoDeAsset('constructor')).toBeUndefined();
});
