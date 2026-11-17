import { expect, test } from 'bun:test';
import { esDireccionPermitida } from './direccion-permitida.ts';

const PAGINA = 'https://pardalis.mx/aventura/jugar';
const CDN = ['https://assets.pardalis.mx'];

test('una dirección del mismo sitio está permitida, relativa o completa', () => {
  expect(esDireccionPermitida('/niveles/casa/nivel.json', PAGINA, [])).toBe(true);
  expect(esDireccionPermitida('niveles/casa/nivel.json', PAGINA, [])).toBe(true);
  expect(esDireccionPermitida('https://pardalis.mx/niveles/casa/nivel.json', PAGINA, [])).toBe(true);
});

test('otro sitio no está permitido si no está en la lista', () => {
  expect(esDireccionPermitida('https://otro-sitio.com/a.svg', PAGINA, [])).toBe(false);
  expect(esDireccionPermitida('https://otro-sitio.com/a.svg', PAGINA, CDN)).toBe(false);
});

test('un origen de la lista está permitido, se escriba con o sin ruta', () => {
  expect(esDireccionPermitida('https://assets.pardalis.mx/aventura/casa/a.svg', PAGINA, CDN)).toBe(true);
  expect(esDireccionPermitida('https://assets.pardalis.mx/a.svg', PAGINA, ['https://assets.pardalis.mx/aventura/'])).toBe(true);
});

test('fuera del propio sitio solo se acepta HTTPS', () => {
  expect(esDireccionPermitida('http://assets.pardalis.mx/a.svg', PAGINA, ['http://assets.pardalis.mx'])).toBe(false);
});

test('en desarrollo, el mismo sitio por HTTP está permitido', () => {
  const paginaLocal = 'http://localhost:3000/';

  expect(esDireccionPermitida('/niveles/casa/nivel.json', paginaLocal, [])).toBe(true);
  expect(esDireccionPermitida('http://localhost:4000/a.svg', paginaLocal, [])).toBe(false);
});

test('algo que no es una dirección no está permitido', () => {
  expect(esDireccionPermitida('https://', PAGINA, [])).toBe(false);
  expect(esDireccionPermitida('/a.svg', 'esto no es una página', [])).toBe(false);
});
