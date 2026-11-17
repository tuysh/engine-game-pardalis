import { expect, test } from 'bun:test';
import type { AssetsDeNivel } from './assets-de-nivel.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from './contenido.ts';
import type { Contenido } from './contenido.ts';
import { crearDiagnostico } from './diagnostico.ts';
import type { Diagnostico } from './diagnostico.ts';
import type { Paso } from './paso.ts';
import { revisarAssets } from './revisar-assets.ts';

const ASSETS: AssetsDeNivel = {
  spr_tortu: {
    carpeta: '.',
    asset: { tipo: 'imagen', archivo: 'img/spr_tortu.svg', anchoEnPixeles: 110, altoEnPixeles: 170 },
  },
  img_rosa: {
    carpeta: '.',
    asset: { tipo: 'animacion', cuadros: ['a_1.svg', 'a_2.svg'], cuadrosPorSegundo: 8, anchoEnPixeles: 50, altoEnPixeles: 50 },
  },
  vo_hola: { carpeta: '.', asset: { tipo: 'audio', archivo: 'voz/vo_hola.mp3' } },
};

/** Revisa un contenido cuyo único diálogo son esos pasos, contra los assets de arriba. */
function revisarPasos(pasos: Paso[]): Diagnostico {
  const contenido: Contenido = {
    meta: { id: 'barrio', titulo: 'El barrio', personajes: { tortu: { idioma: 'es', sprite: 'spr_tortu' } } },
    mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
    estado: { objetivos: [], variables: [], lista: {} },
    secuencias: { prueba: pasos },
    npcs: {},
    interactivos: {},
    cinematicas: {},
    comentarios: {},
  };
  const diagnostico = crearDiagnostico();
  revisarAssets(contenido, ASSETS, diagnostico);
  return diagnostico;
}

test('un contenido cuyos assets existen no tiene errores ni advertencias', () => {
  const diagnostico = revisarPasos([
    { tipo: 'linea', hablante: 'tortu', texto: '¡Hola!', audio: 'vo_hola' },
    {
      tipo: 'elige',
      pregunta: '¿Cuál?',
      opciones: [{ imagen: 'img_rosa', audio: 'vo_hola', alElegir: { tipo: 'pasos', pasos: [] } }],
    },
  ]);

  expect(diagnostico).toEqual({ errores: [], advertencias: [] });
});

test('el sprite de un personaje que no existe es un error', () => {
  const contenido: Contenido = {
    meta: { id: 'barrio', titulo: 'El barrio', personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' } } },
    mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
    estado: { objetivos: [], variables: [], lista: {} },
    secuencias: {},
    npcs: {},
    interactivos: {},
    cinematicas: {},
    comentarios: {},
  };
  const diagnostico = crearDiagnostico();

  revisarAssets(contenido, ASSETS, diagnostico);

  expect(diagnostico.errores).toEqual([
    'meta.personajes.tommy.sprite: no existe la imagen "spr_tommy" en los assets del nivel',
  ]);
});

test('una voz que no existe es solo una advertencia: se usará voz sintetizada', () => {
  const diagnostico = revisarPasos([{ tipo: 'linea', hablante: 'tortu', texto: '¡Adiós!', audio: 'vo_adios' }]);

  expect(diagnostico.errores).toEqual([]);
  expect(diagnostico.advertencias).toEqual([
    'secuencias.prueba[0].audio: no existe la voz "vo_adios"; se usará voz sintetizada',
  ]);
});

test('una línea sin audio no se revisa', () => {
  const diagnostico = revisarPasos([{ tipo: 'linea', hablante: 'tortu', texto: '¡Hola!' }]);

  expect(diagnostico).toEqual({ errores: [], advertencias: [] });
});

test('la imagen de una opción que no existe es un error; su voz, una advertencia', () => {
  const diagnostico = revisarPasos([
    {
      tipo: 'elige',
      pregunta: '¿Cuál?',
      opciones: [{ imagen: 'img_azul', audio: 'vo_azul', alElegir: { tipo: 'pasos', pasos: [] } }],
    },
  ]);

  expect(diagnostico.errores).toEqual([
    'secuencias.prueba[0].opciones[0].imagen: no existe la imagen "img_azul" en los assets del nivel',
  ]);
  expect(diagnostico.advertencias).toEqual([
    'secuencias.prueba[0].opciones[0].audio: no existe la voz "vo_azul"; se usará voz sintetizada',
  ]);
});

test('usar un asset de otro tipo es un error', () => {
  const diagnostico = revisarPasos([
    { tipo: 'linea', hablante: 'tortu', texto: '¡Hola!', audio: 'spr_tortu' },
    {
      tipo: 'elige',
      pregunta: '¿Cuál?',
      opciones: [{ imagen: 'vo_hola', alElegir: { tipo: 'pasos', pasos: [] } }],
    },
  ]);

  expect(diagnostico.errores).toEqual([
    'secuencias.prueba[0].audio: "spr_tortu" es un asset de tipo imagen, y aquí va un audio',
    'secuencias.prueba[1].opciones[0].imagen: "vo_hola" es un asset de tipo audio, y aquí va una imagen',
  ]);
});

test('se revisan también los pasos de adentro de una opción', () => {
  const diagnostico = revisarPasos([
    {
      tipo: 'elige',
      pregunta: '¿Cuál?',
      opciones: [
        {
          imagen: 'img_rosa',
          alElegir: { tipo: 'pasos', pasos: [{ tipo: 'linea', hablante: 'tortu', texto: '¡Sí!', audio: 'vo_si' }] },
        },
      ],
    },
  ]);

  expect(diagnostico.advertencias).toEqual([
    'secuencias.prueba[0].opciones[0].secuencia[0].audio: no existe la voz "vo_si"; se usará voz sintetizada',
  ]);
});

test('una música que no existe es solo una advertencia; una clave de otro tipo, un error', () => {
  const contenidoBase: Contenido = {
    meta: { id: 'barrio', titulo: 'El barrio', personajes: {} },
    mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
    estado: { objetivos: [], variables: [], lista: {} },
    secuencias: {},
    npcs: {},
    interactivos: {},
    cinematicas: {},
    comentarios: {},
  };
  const conMusicaQueFalta: Contenido = {
    ...contenidoBase,
    mundo: { ...AJUSTES_DEL_MUNDO_POR_DEFECTO, sonidos: { musica: 'mus_barrio' } },
  };
  const conUnaImagenComoMusica: Contenido = {
    ...contenidoBase,
    mundo: { ...AJUSTES_DEL_MUNDO_POR_DEFECTO, sonidos: { musica: 'spr_tortu' } },
  };
  const diagnosticoDeLaQueFalta = crearDiagnostico();
  const diagnosticoDeLaImagen = crearDiagnostico();

  revisarAssets(conMusicaQueFalta, ASSETS, diagnosticoDeLaQueFalta);
  revisarAssets(conUnaImagenComoMusica, ASSETS, diagnosticoDeLaImagen);

  expect(diagnosticoDeLaQueFalta).toEqual({
    errores: [],
    advertencias: ['mundo.sonidos.musica: no existe el audio "mus_barrio"; el nivel se jugará sin música'],
  });
  expect(diagnosticoDeLaImagen.errores).toEqual([
    'mundo.sonidos.musica: "spr_tortu" es un asset de tipo imagen, y aquí va un audio',
  ]);
});
