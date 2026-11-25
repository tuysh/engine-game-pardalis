import { expect, test } from 'bun:test';
import type { Manifiesto } from '../../dominio/manifiesto.ts';
import { EscritorDeManifiestosDeJson } from './escritor-de-manifiestos-de-json.ts';
import { LectorDeNivelesDeJson } from './lector-de-niveles-de-json.ts';

const MANIFIESTO: Manifiesto = {
  vo_hola: { tipo: 'audio', archivo: 'voz/vo_hola.mp3' },
  spr_mama: { tipo: 'imagen', archivo: 'img/spr_mama.svg', anchoEnPixeles: 110, altoEnPixeles: 170 },
  tommy_tele: {
    tipo: 'animacion',
    cuadros: ['img/tommy_tele_1.svg', 'img/tommy_tele_2.svg'],
    cuadrosPorSegundo: 4,
    anchoEnPixeles: 90,
    altoEnPixeles: 160,
  },
  intro_tele: { tipo: 'video', archivo: 'video/intro_tele.mp4' },
};

test('el manifiesto se escribe con las claves en orden alfabético y los nombres del archivo', () => {
  const texto = new EscritorDeManifiestosDeJson().redactarManifiesto(MANIFIESTO);

  expect(JSON.parse(texto)).toEqual({
    intro_tele: { tipo: 'video', archivo: 'video/intro_tele.mp4' },
    spr_mama: { tipo: 'imagen', archivo: 'img/spr_mama.svg', ancho: 110, alto: 170 },
    tommy_tele: {
      tipo: 'animacion',
      cuadros: ['img/tommy_tele_1.svg', 'img/tommy_tele_2.svg'],
      fps: 4,
      ancho: 90,
      alto: 160,
    },
    vo_hola: { tipo: 'audio', archivo: 'voz/vo_hola.mp3' },
  });
  expect(Object.keys(JSON.parse(texto))).toEqual(['intro_tele', 'spr_mama', 'tommy_tele', 'vo_hola']);
  expect(texto.endsWith('}\n')).toBe(true);
});

test('lo que se escribe se vuelve a leer igual', () => {
  const texto = new EscritorDeManifiestosDeJson().redactarManifiesto(MANIFIESTO);

  const lectura = new LectorDeNivelesDeJson().leerManifiesto(JSON.parse(texto));

  expect(lectura).toEqual({ tipo: 'leido', valor: MANIFIESTO });
});

test('un manifiesto con una ruta que sale de la carpeta no se acepta', () => {
  const lectura = new LectorDeNivelesDeJson().leerManifiesto({
    spr_mama: { tipo: 'imagen', archivo: '../../secreto.svg', ancho: 110, alto: 170 },
    remoto: { tipo: 'audio', archivo: 'https://otro-sitio.com/a.mp3' },
  });

  const mensaje = 'ruta no permitida: debe ser relativa a la carpeta de assets, sin ".." y sin ser una URL';
  expect(lectura).toEqual({
    tipo: 'invalido',
    errores: [`spr_mama.archivo: ${mensaje}`, `remoto.archivo: ${mensaje}`],
  });
});

test('un asset de un tipo desconocido no se acepta', () => {
  const lectura = new LectorDeNivelesDeJson().leerManifiesto({ modelo: { tipo: 'modelo3d', archivo: 'casa.glb' } });

  expect(lectura.tipo).toBe('invalido');
});

test('assets.config.json se lee como velocidades por animación', () => {
  const lectura = new EscritorDeManifiestosDeJson().leerConfiguracion({ fps: { tommy_tele: 4 } });

  expect(lectura).toEqual({ tipo: 'leido', valor: { cuadrosPorSegundo: { tommy_tele: 4 }, secuencias: {} } });
});

test('assets.config.json con una velocidad que no es un número positivo no se acepta', () => {
  const lectura = new EscritorDeManifiestosDeJson().leerConfiguracion({ fps: { tommy_tele: 0 } });

  expect(lectura).toEqual({
    tipo: 'invalido',
    errores: ['fps.tommy_tele: Demasiado pequeño: se esperaba que número fuera >0'],
  });
});

test('la configuración puede traer la secuencia de cuadros de una animación', () => {
  const lectura = new EscritorDeManifiestosDeJson().leerConfiguracion({ secuencia: { spr_pardi: [1, 1, 2] } });

  expect(lectura).toEqual({ tipo: 'leido', valor: { cuadrosPorSegundo: {}, secuencias: { spr_pardi: [1, 1, 2] } } });
});
