import { expect, test } from 'bun:test';
import { enlacesExternosDeSvg, medirSvg } from './medir-svg.ts';

test('el tamaño sale del viewBox', () => {
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 170"><rect/></svg>';

  expect(medirSvg(svg)).toEqual({ anchoEnPixeles: 110, altoEnPixeles: 170 });
});

test('el viewBox puede separar sus números con comas y llevar decimales', () => {
  const svg = `<svg viewBox='0,0,90.5,160'></svg>`;

  expect(medirSvg(svg)).toEqual({ anchoEnPixeles: 90.5, altoEnPixeles: 160 });
});

test('si hay viewBox y también width y height, manda el viewBox', () => {
  const svg = '<svg width="300" height="300" viewBox="0 0 90 160"></svg>';

  expect(medirSvg(svg)).toEqual({ anchoEnPixeles: 90, altoEnPixeles: 160 });
});

test('sin viewBox, el tamaño sale de width y height, con o sin "px"', () => {
  expect(medirSvg('<svg width="90" height="160"></svg>')).toEqual({ anchoEnPixeles: 90, altoEnPixeles: 160 });
  expect(medirSvg('<svg width="90px" height="160px"></svg>')).toEqual({ anchoEnPixeles: 90, altoEnPixeles: 160 });
});

test('encuentra la etiqueta aunque antes haya una declaración XML y un comentario', () => {
  const svg = '<?xml version="1.0"?>\n<!-- hecho en Inkscape -->\n<svg\n  viewBox="0 0 64 64"\n>\n</svg>';

  expect(medirSvg(svg)).toEqual({ anchoEnPixeles: 64, altoEnPixeles: 64 });
});

test('no confunde stroke-width con width', () => {
  const svg = '<svg stroke-width="3" height="160"></svg>';

  expect(medirSvg(svg)).toBeUndefined();
});

test('un SVG sin tamaño, con tamaño en porcentaje o con viewBox incompleto no se puede medir', () => {
  expect(medirSvg('<svg xmlns="http://www.w3.org/2000/svg"></svg>')).toBeUndefined();
  expect(medirSvg('<svg width="100%" height="100%"></svg>')).toBeUndefined();
  expect(medirSvg('<svg viewBox="0 0 90"></svg>')).toBeUndefined();
  expect(medirSvg('<svg viewBox="0 0 0 160"></svg>')).toBeUndefined();
  expect(medirSvg('esto no es un svg')).toBeUndefined();
});

test('detecta los archivos externos que el SVG enlaza', () => {
  const svg =
    '<svg viewBox="0 0 10 10"><image href="foto.png"/><use xlink:href="https://sitio.com/iconos.svg#a"/></svg>';

  expect(enlacesExternosDeSvg(svg)).toEqual(['foto.png', 'https://sitio.com/iconos.svg#a']);
});

test('los enlaces a partes del mismo dibujo y el contenido incrustado no son externos', () => {
  const svg =
    '<svg viewBox="0 0 10 10"><use href="#sombra"/><image href="data:image/png;base64,AAAA"/><a href=""/></svg>';

  expect(enlacesExternosDeSvg(svg)).toEqual([]);
});
