import { expect, test } from 'bun:test';
import { armarManifiesto } from './armar-manifiesto.ts';
import type { ArchivoDeAsset } from './armar-manifiesto.ts';

/** Una carpeta sin `assets.config.json`. */
const SIN_AJUSTES = { cuadrosPorSegundo: {}, secuencias: {} };
const MEDIDAS_DE_TOMMY = { anchoEnPixeles: 90, altoEnPixeles: 160 };

test('cada archivo se registra con su nombre sin extensión como clave', () => {
  const archivos: ArchivoDeAsset[] = [
    { tipo: 'imagen', ruta: 'img/spr_mama.svg', medidas: { anchoEnPixeles: 110, altoEnPixeles: 170 } },
    { tipo: 'audio', ruta: 'voz/vo_mama_tortillas.mp3' },
    { tipo: 'video', ruta: 'video/intro_tele.mp4' },
  ];

  const armado = armarManifiesto(archivos, SIN_AJUSTES);

  expect(armado.errores).toEqual([]);
  expect(armado.manifiesto).toEqual({
    spr_mama: { tipo: 'imagen', archivo: 'img/spr_mama.svg', anchoEnPixeles: 110, altoEnPixeles: 170 },
    vo_mama_tortillas: { tipo: 'audio', archivo: 'voz/vo_mama_tortillas.mp3' },
    intro_tele: { tipo: 'video', archivo: 'video/intro_tele.mp4' },
  });
});

test('las imágenes numeradas se agrupan en una animación, en orden numérico y no alfabético', () => {
  const archivos: ArchivoDeAsset[] = [
    { tipo: 'imagen', ruta: 'img/tommy_camina_10.svg', medidas: MEDIDAS_DE_TOMMY },
    { tipo: 'imagen', ruta: 'img/tommy_camina_2.svg', medidas: MEDIDAS_DE_TOMMY },
    { tipo: 'imagen', ruta: 'img/tommy_camina_1.svg', medidas: MEDIDAS_DE_TOMMY },
  ];

  const armado = armarManifiesto(archivos, SIN_AJUSTES);

  expect(armado.errores).toEqual([]);
  expect(armado.manifiesto).toEqual({
    tommy_camina: {
      tipo: 'animacion',
      cuadros: ['img/tommy_camina_1.svg', 'img/tommy_camina_2.svg', 'img/tommy_camina_10.svg'],
      cuadrosPorSegundo: 8,
      anchoEnPixeles: 90,
      altoEnPixeles: 160,
    },
  });
});

test('la velocidad de una animación sale de la configuración cuando la nombra', () => {
  const archivos: ArchivoDeAsset[] = [
    { tipo: 'imagen', ruta: 'tommy_viendo_tele_1.svg', medidas: MEDIDAS_DE_TOMMY },
    { tipo: 'imagen', ruta: 'tommy_viendo_tele_2.svg', medidas: MEDIDAS_DE_TOMMY },
  ];

  const armado = armarManifiesto(archivos, { cuadrosPorSegundo: { tommy_viendo_tele: 4 }, secuencias: {} });

  expect(armado.manifiesto['tommy_viendo_tele']).toMatchObject({ tipo: 'animacion', cuadrosPorSegundo: 4 });
  expect(armado.advertencias).toEqual([]);
});

test('una sola imagen numerada no es una animación: se queda como imagen con su nombre completo', () => {
  const archivos: ArchivoDeAsset[] = [{ tipo: 'imagen', ruta: 'img/casa_2.svg', medidas: MEDIDAS_DE_TOMMY }];

  const armado = armarManifiesto(archivos, SIN_AJUSTES);

  expect(armado.manifiesto).toEqual({
    casa_2: { tipo: 'imagen', archivo: 'img/casa_2.svg', anchoEnPixeles: 90, altoEnPixeles: 160 },
  });
});

test('los cuadros de una animación deben medir lo mismo', () => {
  const archivos: ArchivoDeAsset[] = [
    { tipo: 'imagen', ruta: 'img/tommy_1.svg', medidas: { anchoEnPixeles: 90, altoEnPixeles: 160 } },
    { tipo: 'imagen', ruta: 'img/tommy_2.svg', medidas: { anchoEnPixeles: 90, altoEnPixeles: 170 } },
  ];

  const armado = armarManifiesto(archivos, SIN_AJUSTES);

  expect(armado.errores).toEqual([
    'animación "tommy": img/tommy_2.svg mide 90×170 y img/tommy_1.svg mide 90×160; ' +
      'todos los cuadros deben tener el mismo tamaño (viewBox)',
  ]);
});

test('dos archivos con el mismo nombre en carpetas o formatos distintos chocan', () => {
  const archivos: ArchivoDeAsset[] = [
    { tipo: 'imagen', ruta: 'img/hola.svg', medidas: MEDIDAS_DE_TOMMY },
    { tipo: 'audio', ruta: 'voz/hola.mp3' },
  ];

  const armado = armarManifiesto(archivos, SIN_AJUSTES);

  expect(armado.errores).toEqual([
    'la clave "hola" sale de dos archivos: img/hola.svg y voz/hola.mp3; cambia el nombre de uno',
  ]);
});

test('una imagen y una animación no pueden dar la misma clave', () => {
  const archivos: ArchivoDeAsset[] = [
    { tipo: 'imagen', ruta: 'img/tommy.svg', medidas: MEDIDAS_DE_TOMMY },
    { tipo: 'imagen', ruta: 'img/tommy_1.svg', medidas: MEDIDAS_DE_TOMMY },
    { tipo: 'imagen', ruta: 'img/tommy_2.svg', medidas: MEDIDAS_DE_TOMMY },
  ];

  const armado = armarManifiesto(archivos, SIN_AJUSTES);

  expect(armado.errores).toEqual([
    'la clave "tommy" sale de dos archivos: img/tommy.svg y los cuadros img/tommy_1.svg…; cambia el nombre de uno',
  ]);
});

test('una velocidad para algo que no es una animación da advertencia', () => {
  const archivos: ArchivoDeAsset[] = [{ tipo: 'imagen', ruta: 'img/spr_mama.svg', medidas: MEDIDAS_DE_TOMMY }];

  const armado = armarManifiesto(archivos, { cuadrosPorSegundo: { spr_mama: 4 }, secuencias: {} });

  expect(armado.errores).toEqual([]);
  expect(armado.advertencias).toEqual([
    'assets.config.json: "fps" nombra "spr_mama", que no es una animación de esta carpeta',
  ]);
});

test('una carpeta sin assets da un manifiesto vacío', () => {
  expect(armarManifiesto([], SIN_AJUSTES)).toEqual({ manifiesto: {}, errores: [], advertencias: [] });
});

test('una numeración que no va seguida desde 1 se agrupa igual, pero avisa que quizá no son cuadros', () => {
  const archivos: ArchivoDeAsset[] = [
    { tipo: 'imagen', ruta: 'img/item_moneda_1.svg', medidas: MEDIDAS_DE_TOMMY },
    { tipo: 'imagen', ruta: 'img/item_moneda_5.svg', medidas: MEDIDAS_DE_TOMMY },
    { tipo: 'imagen', ruta: 'img/item_moneda_10.svg', medidas: MEDIDAS_DE_TOMMY },
  ];

  const armado = armarManifiesto(archivos, SIN_AJUSTES);

  expect(armado.manifiesto['item_moneda']).toMatchObject({ tipo: 'animacion' });
  expect(armado.advertencias).toEqual([
    '"item_moneda_1", "item_moneda_5", "item_moneda_10" se agruparon en la animación "item_moneda", ' +
      'pero sus números no van seguidos desde 1; ' +
      'si son imágenes distintas, cámbiales el nombre para que no termine en _número',
  ]);
});

test('una numeración que no empieza en 1 también avisa', () => {
  const archivos: ArchivoDeAsset[] = [
    { tipo: 'imagen', ruta: 'item_billete_20.svg', medidas: MEDIDAS_DE_TOMMY },
    { tipo: 'imagen', ruta: 'item_billete_50.svg', medidas: MEDIDAS_DE_TOMMY },
  ];

  const armado = armarManifiesto(archivos, SIN_AJUSTES);

  expect(armado.advertencias).toHaveLength(1);
});

test('una secuencia de la configuración decide el orden de los cuadros y puede repetirlos', () => {
  const archivos: ArchivoDeAsset[] = [
    { tipo: 'imagen', ruta: 'img/spr_pardi_1.svg', medidas: MEDIDAS_DE_TOMMY },
    { tipo: 'imagen', ruta: 'img/spr_pardi_2.svg', medidas: MEDIDAS_DE_TOMMY },
  ];

  const armado = armarManifiesto(archivos, { cuadrosPorSegundo: {}, secuencias: { spr_pardi: [1, 1, 1, 2] } });

  expect(armado.errores).toEqual([]);
  expect(armado.manifiesto['spr_pardi']).toMatchObject({
    tipo: 'animacion',
    cuadros: ['img/spr_pardi_1.svg', 'img/spr_pardi_1.svg', 'img/spr_pardi_1.svg', 'img/spr_pardi_2.svg'],
  });
});

test('una secuencia que nombra un cuadro que no existe es un error', () => {
  const archivos: ArchivoDeAsset[] = [
    { tipo: 'imagen', ruta: 'img/spr_pardi_1.svg', medidas: MEDIDAS_DE_TOMMY },
    { tipo: 'imagen', ruta: 'img/spr_pardi_2.svg', medidas: MEDIDAS_DE_TOMMY },
  ];

  const armado = armarManifiesto(archivos, { cuadrosPorSegundo: {}, secuencias: { spr_pardi: [1, 3] } });

  expect(armado.errores).toEqual([
    'assets.config.json: "secuencia" de "spr_pardi" nombra el cuadro 3, pero no hay un archivo "spr_pardi_3"',
  ]);
});

test('una secuencia para algo que no es una animación da advertencia', () => {
  const archivos: ArchivoDeAsset[] = [{ tipo: 'imagen', ruta: 'img/spr_mama.svg', medidas: MEDIDAS_DE_TOMMY }];

  const armado = armarManifiesto(archivos, { cuadrosPorSegundo: {}, secuencias: { spr_mama: [1, 2] } });

  expect(armado.advertencias).toEqual([
    'assets.config.json: "secuencia" nombra "spr_mama", que no es una animación de esta carpeta',
  ]);
});
