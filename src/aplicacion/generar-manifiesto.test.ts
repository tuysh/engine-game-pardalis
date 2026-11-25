import { expect, test } from 'bun:test';
import { CarpetasDeMemoria } from '../adaptadores/memoria/carpetas-de-memoria.ts';
import type { ConfiguracionDeAssets, Manifiesto } from '../dominio/manifiesto.ts';
import type { EscritorDeManifiestos } from '../puertos/escritor-de-manifiestos.ts';
import { generarManifiesto } from './generar-manifiesto.ts';

/**
 * Escritor falso: «redacta» el manifiesto como JSON del dominio, sin cambiarle los nombres,
 * y acepta cualquier configuración que tenga la forma `{ cuadrosPorSegundo, secuencias }`.
 */
const ESCRITOR_FALSO: EscritorDeManifiestos = {
  leerConfiguracion(json) {
    const esConfiguracion = typeof json === 'object' && json !== null && 'cuadrosPorSegundo' in json;
    if (!esConfiguracion) return { tipo: 'invalido', errores: ['falta cuadrosPorSegundo'] };
    return { tipo: 'leido', valor: json as ConfiguracionDeAssets }; // la línea de arriba comprobó la forma
  },
  redactarManifiesto(manifiesto) {
    return JSON.stringify(manifiesto);
  },
};

function svgDe(ancho: number, alto: number): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${ancho} ${alto}"></svg>`;
}

/** Lee el manifiesto que el caso de uso escribió en la carpeta falsa. */
function manifiestoEscrito(carpetas: CarpetasDeMemoria, carpeta: string): Manifiesto | undefined {
  const texto = carpetas.textoEscrito(carpeta, 'assets.json');
  if (texto === undefined) return undefined;
  return JSON.parse(texto) as Manifiesto; // el escritor falso lo escribió con `JSON.stringify(manifiesto)`
}

test('genera el manifiesto con imágenes medidas, audio y video, e ignora lo que no es un asset', async () => {
  const carpetas = new CarpetasDeMemoria({
    'niveles/casa': {
      'nivel.json': '{}',
      'mapa.tmj': '{}',
      'img/spr_mama.svg': svgDe(110, 170),
      'voz/vo_mama_tortillas.mp3': new Uint8Array([1, 2, 3]),
      'video/intro_tele.mp4': new Uint8Array([1, 2, 3]),
    },
  });

  const resultado = await generarManifiesto('niveles/casa', { carpetas, escritor: ESCRITOR_FALSO });

  expect(resultado).toEqual({ errores: [], advertencias: [], cantidadDeAssets: 3, animaciones: [] });
  expect(manifiestoEscrito(carpetas, 'niveles/casa')).toEqual({
    spr_mama: { tipo: 'imagen', archivo: 'img/spr_mama.svg', anchoEnPixeles: 110, altoEnPixeles: 170 },
    intro_tele: { tipo: 'video', archivo: 'video/intro_tele.mp4' },
    vo_mama_tortillas: { tipo: 'audio', archivo: 'voz/vo_mama_tortillas.mp3' },
  });
});

test('las imágenes numeradas salen como animación, con la velocidad de assets.config.json', async () => {
  const carpetas = new CarpetasDeMemoria({
    'niveles/casa': {
      'assets.config.json': '{ "cuadrosPorSegundo": { "tommy_tele": 4 }, "secuencias": {} }',
      'img/tommy_tele_1.svg': svgDe(90, 160),
      'img/tommy_tele_2.svg': svgDe(90, 160),
    },
  });

  const resultado = await generarManifiesto('niveles/casa', { carpetas, escritor: ESCRITOR_FALSO });

  expect(resultado.errores).toEqual([]);
  expect(manifiestoEscrito(carpetas, 'niveles/casa')).toEqual({
    tommy_tele: {
      tipo: 'animacion',
      cuadros: ['img/tommy_tele_1.svg', 'img/tommy_tele_2.svg'],
      cuadrosPorSegundo: 4,
      anchoEnPixeles: 90,
      altoEnPixeles: 160,
    },
  });
});

test('un SVG sin viewBox es un error y entonces no se escribe el manifiesto', async () => {
  const carpetas = new CarpetasDeMemoria({
    'niveles/casa': {
      'img/spr_mama.svg': svgDe(110, 170),
      'img/sin_medidas.svg': '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    },
  });

  const resultado = await generarManifiesto('niveles/casa', { carpetas, escritor: ESCRITOR_FALSO });

  expect(resultado).toEqual({
    errores: [
      'img/sin_medidas.svg: el SVG no tiene viewBox (ni width y height); agrégale un viewBox para saber su tamaño',
    ],
    advertencias: [],
    cantidadDeAssets: 0,
    animaciones: [],
  });
  expect(manifiestoEscrito(carpetas, 'niveles/casa')).toBeUndefined();
});

test('una imagen PNG dañada es un error', async () => {
  const carpetas = new CarpetasDeMemoria({ 'niveles/casa': { 'img/fondo.png': new Uint8Array([1, 2, 3]) } });

  const resultado = await generarManifiesto('niveles/casa', { carpetas, escritor: ESCRITOR_FALSO });

  expect(resultado.errores).toEqual([
    'img/fondo.png: no se pudo leer el tamaño de la imagen; revisa que el archivo no esté dañado',
  ]);
});

test('un SVG que enlaza archivos externos da advertencia, pero el manifiesto se escribe', async () => {
  const carpetas = new CarpetasDeMemoria({
    'niveles/casa': { 'img/cartel.svg': '<svg viewBox="0 0 10 10"><image href="foto.png"/></svg>' },
  });

  const resultado = await generarManifiesto('niveles/casa', { carpetas, escritor: ESCRITOR_FALSO });

  expect(resultado).toEqual({
    errores: [],
    advertencias: ['img/cartel.svg: el SVG enlaza archivos externos (foto.png); al usarse como textura no se cargan'],
    cantidadDeAssets: 1,
    animaciones: [],
  });
});

test('una carpeta que no existe se reporta como error', async () => {
  const carpetas = new CarpetasDeMemoria({});

  const resultado = await generarManifiesto('niveles/no_existe', { carpetas, escritor: ESCRITOR_FALSO });

  expect(resultado).toEqual({
    errores: ['no existe la carpeta niveles/no_existe'],
    advertencias: [],
    cantidadDeAssets: 0,
    animaciones: [],
  });
});

test('un assets.config.json que no es JSON es un error', async () => {
  const carpetas = new CarpetasDeMemoria({ 'niveles/casa': { 'assets.config.json': '{ fps: ' } });

  const resultado = await generarManifiesto('niveles/casa', { carpetas, escritor: ESCRITOR_FALSO });

  expect(resultado.errores).toHaveLength(1);
  expect(resultado.errores[0]).toStartWith('assets.config.json no es JSON válido: ');
});

test('un assets.config.json con otra forma se reporta con el nombre del archivo', async () => {
  const carpetas = new CarpetasDeMemoria({ 'niveles/casa': { 'assets.config.json': '{ "velocidades": {} }' } });

  const resultado = await generarManifiesto('niveles/casa', { carpetas, escritor: ESCRITOR_FALSO });

  expect(resultado.errores).toEqual(['assets.config.json: falta cuadrosPorSegundo']);
});

test('el resultado lista las animaciones que se formaron, para que una inesperada se note', async () => {
  const carpetas = new CarpetasDeMemoria({
    'niveles/casa': {
      'img/tele_1.svg': svgDe(40, 30),
      'img/tele_2.svg': svgDe(40, 30),
      'img/spr_mama.svg': svgDe(110, 170),
    },
  });

  const resultado = await generarManifiesto('niveles/casa', { carpetas, escritor: ESCRITOR_FALSO });

  expect(resultado.animaciones).toEqual([{ clave: 'tele', cantidadDeCuadros: 2, cuadrosPorSegundo: 8 }]);
});
