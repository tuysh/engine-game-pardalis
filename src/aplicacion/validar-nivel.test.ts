import { expect, test } from 'bun:test';
import { CargadorDeMemoria } from '../adaptadores/memoria/cargador-de-memoria.ts';
import { LectorDeNivelesDeMemoria } from '../adaptadores/memoria/lector-de-niveles-de-memoria.ts';
import type { Contenido } from '../dominio/contenido.ts';
import type { DescripcionDeNivel } from '../dominio/descripcion-de-nivel.ts';
import { validarNivel } from './validar-nivel.ts';

const DESCRIPCION: DescripcionDeNivel = { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.'] };

const CONTENIDO: Contenido = {
  meta: { id: 'casa', titulo: 'La casa', personajes: { mama: { idioma: 'es', sprite: 'spr_mama' } } },
  estado: { objetivos: [], variables: [], lista: {} },
  secuencias: { saludo: [{ tipo: 'linea', hablante: 'mama', texto: '¡Hola!' }] },
  npcs: {},
  interactivos: {},
  comentarios: {},
};

/** Los dos archivos de un nivel. Su contenido no importa: el lector falso no lo mira. */
const ARCHIVOS = { 'niveles/casa/nivel.json': {}, 'niveles/casa/contenido.json': {} };

test('un nivel correcto se entrega listo, sin errores', async () => {
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    descripcion: { tipo: 'leido', valor: DESCRIPCION },
    contenido: { tipo: 'leido', valor: CONTENIDO },
  });

  const resultado = await validarNivel({ direccionDelNivel: 'niveles/casa/nivel.json' }, { cargador, lector });

  expect(resultado).toEqual({
    errores: [],
    advertencias: [],
    nivel: { descripcion: DESCRIPCION, contenido: CONTENIDO },
  });
});

test('si no existe nivel.json, se reporta y no hay nivel', async () => {
  const cargador = new CargadorDeMemoria({});
  const lector = new LectorDeNivelesDeMemoria({
    descripcion: { tipo: 'leido', valor: DESCRIPCION },
    contenido: { tipo: 'leido', valor: CONTENIDO },
  });

  const resultado = await validarNivel({ direccionDelNivel: 'niveles/casa/nivel.json' }, { cargador, lector });

  expect(resultado).toEqual({ errores: ['no existe el archivo niveles/casa/nivel.json'], advertencias: [] });
});

test('los errores de nivel.json dicen de qué archivo son', async () => {
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    descripcion: { tipo: 'invalido', errores: ['contenido: falta'] },
    contenido: { tipo: 'leido', valor: CONTENIDO },
  });

  const resultado = await validarNivel({ direccionDelNivel: 'niveles/casa/nivel.json' }, { cargador, lector });

  expect(resultado.errores).toEqual(['niveles/casa/nivel.json: contenido: falta']);
  expect(resultado.nivel).toBeUndefined();
});

test('el contenido se busca junto a nivel.json, con la ruta que nivel.json indica', async () => {
  const cargador = new CargadorDeMemoria({ 'niveles/casa/nivel.json': {} });
  const lector = new LectorDeNivelesDeMemoria({
    descripcion: { tipo: 'leido', valor: { ...DESCRIPCION, contenido: 'historia.json' } },
    contenido: { tipo: 'leido', valor: CONTENIDO },
  });

  const resultado = await validarNivel({ direccionDelNivel: 'niveles/casa/nivel.json' }, { cargador, lector });

  expect(resultado.errores).toEqual(['no existe el archivo niveles/casa/historia.json']);
});

test('si el contenido no tiene la forma esperada, se reportan sus errores y no se revisan los enlaces', async () => {
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    descripcion: { tipo: 'leido', valor: DESCRIPCION },
    contenido: { tipo: 'invalido', errores: ['meta.id: falta'] },
  });

  const resultado = await validarNivel({ direccionDelNivel: 'niveles/casa/nivel.json' }, { cargador, lector });

  expect(resultado).toEqual({ errores: ['meta.id: falta'], advertencias: [] });
});

test('un enlace roto en el contenido es un error y no se entrega el nivel', async () => {
  const contenidoConEnlaceRoto: Contenido = {
    ...CONTENIDO,
    secuencias: { saludo: [{ tipo: 'linea', hablante: 'papa', texto: '¡Hola!' }] },
  };
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    descripcion: { tipo: 'leido', valor: DESCRIPCION },
    contenido: { tipo: 'leido', valor: contenidoConEnlaceRoto },
  });

  const resultado = await validarNivel({ direccionDelNivel: 'niveles/casa/nivel.json' }, { cargador, lector });

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
    descripcion: { tipo: 'leido', valor: DESCRIPCION },
    contenido: { tipo: 'leido', valor: contenidoConMinijuego },
  });
  const pedido = { direccionDelNivel: 'niveles/casa/nivel.json', minijuegos: ['Tortilleria'] };

  const resultado = await validarNivel(pedido, { cargador, lector });

  expect(resultado.errores).toEqual([
    'minijuego "Fruteria" usado en secuencias.jugar[0] pero el host no lo registró en "minijuegos"',
  ]);
});

test('las advertencias no impiden entregar el nivel', async () => {
  const contenidoConRamaInalcanzable: Contenido = {
    ...CONTENIDO,
    npcs: { mama: { dialogo: [{ pasos: [] }, { pasos: [] }] } },
  };
  const cargador = new CargadorDeMemoria(ARCHIVOS);
  const lector = new LectorDeNivelesDeMemoria({
    descripcion: { tipo: 'leido', valor: DESCRIPCION },
    contenido: { tipo: 'leido', valor: contenidoConRamaInalcanzable },
  });

  const resultado = await validarNivel({ direccionDelNivel: 'niveles/casa/nivel.json' }, { cargador, lector });

  expect(resultado.errores).toEqual([]);
  expect(resultado.advertencias).toHaveLength(1);
  expect(resultado.nivel).toBeDefined();
});
