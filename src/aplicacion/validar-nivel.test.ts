import { expect, test } from 'bun:test';
import { CargadorDeMemoria } from '../adaptadores/memoria/cargador-de-memoria.ts';
import { LectorDeMapasDeMemoria } from '../adaptadores/memoria/lector-de-mapas-de-memoria.ts';
import { LectorDeNivelesDeMemoria } from '../adaptadores/memoria/lector-de-niveles-de-memoria.ts';
import type { LecturasPreparadas } from '../adaptadores/memoria/lector-de-niveles-de-memoria.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import type { Contenido } from '../dominio/contenido.ts';
import type { DescripcionDeNivel } from '../dominio/descripcion-de-nivel.ts';
import type { Manifiesto } from '../dominio/manifiesto.ts';
import type { Mundo } from '../dominio/mundo.ts';
import { validarNivel } from './validar-nivel.ts';

const DESCRIPCION: DescripcionDeNivel = { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.'] };

const CONTENIDO: Contenido = {
  meta: { id: 'casa', titulo: 'La casa', personajes: { mama: { idioma: 'es', sprite: 'spr_mama' } } },
  mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
  estado: { objetivos: [], variables: [], lista: {} },
  secuencias: { saludo: [{ tipo: 'linea', hablante: 'mama', texto: '¡Hola!' }] },
  npcs: {},
  interactivos: {},
  comentarios: {},
};

const MANIFIESTO: Manifiesto = {
  spr_mama: { tipo: 'imagen', archivo: 'img/spr_mama.svg', anchoEnPixeles: 110, altoEnPixeles: 170 },
};

/** Un mundo mínimo que coincide con el contenido de arriba: solo tiene piso. */
const MUNDO: Mundo = {
  anchoEnMetros: 10,
  profundidadEnMetros: 6,
  telones: [],
  decorado: [],
  npcs: {},
  iniciosDelJugador: [],
  puntos: {},
  zonas: {},
  pisos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 6 }]],
};

/** Los archivos de un nivel. Su contenido no importa: los lectores falsos no lo miran. */
const ARCHIVOS = {
  'niveles/casa/nivel.json': {},
  'niveles/casa/contenido.json': {},
  'niveles/casa/mapa.tmj': {},
  'niveles/casa/assets.json': {},
};

/** Lo que el lector falso responde para un nivel correcto. Cada prueba cambia solo lo que quiere comprobar. */
const LECTURAS_CORRECTAS: LecturasPreparadas = {
  descripcion: { tipo: 'leido', valor: DESCRIPCION },
  contenido: { tipo: 'leido', valor: CONTENIDO },
  manifiesto: { tipo: 'leido', valor: MANIFIESTO },
};

const PEDIDO = { direccionDelNivel: 'niveles/casa/nivel.json' };

test('un nivel correcto se entrega listo, sin errores', async () => {
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria(LECTURAS_CORRECTAS);

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado).toEqual({
    errores: [],
    advertencias: [],
    nivel: {
      descripcion: DESCRIPCION,
      contenido: CONTENIDO,
      mundo: MUNDO,
      assets: { spr_mama: { asset: MANIFIESTO['spr_mama']!, carpeta: '.' } },
    },
  });
});

test('si no existe nivel.json, se reporta y no hay nivel', async () => {
  const cargador = new CargadorDeMemoria({});
  const lector = new LectorDeNivelesDeMemoria(LECTURAS_CORRECTAS);

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado).toEqual({ errores: ['no existe el archivo niveles/casa/nivel.json'], advertencias: [] });
});

test('los errores de nivel.json dicen de qué archivo son', async () => {
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    ...LECTURAS_CORRECTAS,
    descripcion: { tipo: 'invalido', errores: ['contenido: falta'] },
  });

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado.errores).toEqual(['niveles/casa/nivel.json: contenido: falta']);
  expect(resultado.nivel).toBeUndefined();
});

test('el contenido se busca junto a nivel.json, con la ruta que nivel.json indica', async () => {
  const cargador = new CargadorDeMemoria({ 'niveles/casa/nivel.json': {} });
  const lector = new LectorDeNivelesDeMemoria({
    ...LECTURAS_CORRECTAS,
    descripcion: { tipo: 'leido', valor: { ...DESCRIPCION, contenido: 'historia.json' } },
  });

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado.errores).toEqual(['no existe el archivo niveles/casa/historia.json']);
});

test('si el contenido no tiene la forma esperada, se reportan sus errores y no se revisa nada más', async () => {
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    ...LECTURAS_CORRECTAS,
    contenido: { tipo: 'invalido', errores: ['meta.id: falta'] },
  });

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado).toEqual({ errores: ['meta.id: falta'], advertencias: [] });
});

test('un enlace roto en el contenido es un error y no se entrega el nivel', async () => {
  const contenidoConEnlaceRoto: Contenido = {
    ...CONTENIDO,
    secuencias: { saludo: [{ tipo: 'linea', hablante: 'papa', texto: '¡Hola!' }] },
  };
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    ...LECTURAS_CORRECTAS,
    contenido: { tipo: 'leido', valor: contenidoConEnlaceRoto },
  });

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado.errores).toEqual(['secuencias.saludo[0]: el hablante "papa" no existe en meta.personajes']);
  expect(resultado.nivel).toBeUndefined();
});

test('los minijuegos del host se usan para revisar los pasos "juego"', async () => {
  const contenidoConMinijuego: Contenido = {
    ...CONTENIDO,
    secuencias: { jugar: [{ tipo: 'juego', nombre: 'Fruteria', config: undefined }] },
  };
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    ...LECTURAS_CORRECTAS,
    contenido: { tipo: 'leido', valor: contenidoConMinijuego },
  });

  const resultado = await validarNivel({ ...PEDIDO, minijuegos: ['Tortilleria'] }, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado.errores).toEqual([
    'minijuego "Fruteria" usado en secuencias.jugar[0] pero el host no lo registró en "minijuegos"',
  ]);
});

test('las advertencias no impiden entregar el nivel', async () => {
  const contenidoConOpcionSinImagen: Contenido = {
    ...CONTENIDO,
    secuencias: {
      pregunta: [
        { tipo: 'elige', pregunta: '¿Vamos?', opciones: [{ texto: 'Sí', alElegir: { tipo: 'pasos', pasos: [] } }] },
      ],
    },
  };
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    ...LECTURAS_CORRECTAS,
    contenido: { tipo: 'leido', valor: contenidoConOpcionSinImagen },
  });

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado.errores).toEqual([]);
  expect(resultado.advertencias).toHaveLength(1);
  expect(resultado.nivel).toBeDefined();
});

test('si a una carpeta de assets le falta su manifiesto, el error dice cómo generarlo', async () => {
  const cargador = new CargadorDeMemoria({
    'niveles/casa/nivel.json': {},
    'niveles/casa/contenido.json': {},
    'niveles/casa/mapa.tmj': {},
  });
  const lector = new LectorDeNivelesDeMemoria(LECTURAS_CORRECTAS);

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado.errores).toEqual([
    'no existe el archivo niveles/casa/assets.json; el manifiesto se genera con: escenario-engine assets <carpeta>',
  ]);
});

test('el manifiesto de cada carpeta se busca relativo a nivel.json', async () => {
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    ...LECTURAS_CORRECTAS,
    descripcion: { tipo: 'leido', valor: { ...DESCRIPCION, assets: ['.', 'comun'] } },
  });

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado.errores).toEqual([
    'no existe el archivo niveles/casa/comun/assets.json; el manifiesto se genera con: escenario-engine assets <carpeta>',
  ]);
});

test('los errores de un manifiesto dicen de qué archivo son', async () => {
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    ...LECTURAS_CORRECTAS,
    manifiesto: { tipo: 'invalido', errores: ['spr_mama.archivo: ruta no permitida'] },
  });

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado.errores).toEqual(['niveles/casa/assets.json: spr_mama.archivo: ruta no permitida']);
});

test('una imagen que el contenido nombra y no está en los assets es un error', async () => {
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({ ...LECTURAS_CORRECTAS, manifiesto: { tipo: 'leido', valor: {} } });

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado.errores).toEqual([
    'meta.personajes.mama.sprite: no existe la imagen "spr_mama" en los assets del nivel',
  ]);
  expect(resultado.nivel).toBeUndefined();
});

test('una voz que falta es una advertencia y el nivel se entrega', async () => {
  const contenidoConVoz: Contenido = {
    ...CONTENIDO,
    secuencias: { saludo: [{ tipo: 'linea', hablante: 'mama', texto: '¡Hola!', audio: 'vo_mama_hola' }] },
  };
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    ...LECTURAS_CORRECTAS,
    contenido: { tipo: 'leido', valor: contenidoConVoz },
  });

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas: new LectorDeMapasDeMemoria(MUNDO) });

  expect(resultado.errores).toEqual([]);
  expect(resultado.advertencias).toEqual([
    'secuencias.saludo[0].audio: no existe la voz "vo_mama_hola"; se usará voz sintetizada',
  ]);
  expect(resultado.nivel).toBeDefined();
});

test('si no existe el mapa que nivel.json indica, se reporta', async () => {
  const cargador = new CargadorDeMemoria({ 'niveles/casa/nivel.json': {}, 'niveles/casa/contenido.json': {} });
  const lector = new LectorDeNivelesDeMemoria(LECTURAS_CORRECTAS);
  const lectorDeMapas = new LectorDeMapasDeMemoria(MUNDO);

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas });

  expect(resultado.errores).toEqual(['no existe el archivo niveles/casa/mapa.tmj']);
});

test('si el mapa no se puede leer, se reportan sus errores y no hay nivel', async () => {
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria(LECTURAS_CORRECTAS);
  const lectorDeMapas = new LectorDeMapasDeMemoria(undefined, ['mapa: el archivo no es un mapa de Tiled']);

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas });

  expect(resultado).toEqual({ errores: ['mapa: el archivo no es un mapa de Tiled'], advertencias: [] });
});

test('el mapa se cruza con el contenido', async () => {
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria(LECTURAS_CORRECTAS);
  const mundoSinPiso: Mundo = { ...MUNDO, pisos: [] };
  const lectorDeMapas = new LectorDeMapasDeMemoria(mundoSinPiso);

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas });

  expect(resultado.errores).toEqual(['mapa: la capa "piso" necesita al menos un polígono por donde caminar']);
});

test('las imágenes que el mapa nombra también deben estar en los assets', async () => {
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria(LECTURAS_CORRECTAS);
  const mundoConSuelo: Mundo = { ...MUNDO, suelo: { asset: 'suelo_casa', esquina: { x: 0, y: 0 } } };
  const lectorDeMapas = new LectorDeMapasDeMemoria(mundoConSuelo);

  const resultado = await validarNivel(PEDIDO, { cargador, lector, lectorDeMapas });

  expect(resultado.errores).toEqual(['mapa: la capa "suelo": no existe la imagen "suelo_casa" en los assets del nivel']);
});
