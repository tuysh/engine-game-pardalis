import { expect, test } from 'bun:test';
import type { Contenido } from '../../dominio/contenido.ts';
import type { Paso } from '../../dominio/paso.ts';
import { LectorDeNivelesDeJson } from './lector-de-niveles-de-json.ts';

const META = { id: 'tortilleria', titulo: 'La Tortillería', personajes: { tortu: { idioma: 'es', sprite: 'spr_tortu' } } };

/** Lee un contenido cuyo único diálogo son esos pasos y devuelve los pasos ya convertidos. */
function leerPasos(pasosEnJson: unknown[]): readonly Paso[] {
  const lectura = new LectorDeNivelesDeJson().leerContenido({
    meta: META,
    npcs: { tortu: { dialogo: [{ dice: pasosEnJson }] } },
  });
  if (lectura.tipo !== 'leido') throw new Error(`no se pudo leer: ${lectura.errores.join('; ')}`);
  return lectura.valor.npcs['tortu']!.dialogo[0]!.pasos;
}

/** Lee un contenido que debe estar mal y devuelve sus errores. */
function erroresDe(contenidoEnJson: unknown): readonly string[] {
  const lectura = new LectorDeNivelesDeJson().leerContenido(contenidoEnJson);
  if (lectura.tipo !== 'invalido') throw new Error('se esperaba un contenido inválido');
  return lectura.errores;
}

test('un contenido con solo "meta" se lee con todas las demás secciones vacías', () => {
  const lectura = new LectorDeNivelesDeJson().leerContenido({ meta: META });

  const esperado: Contenido = {
    meta: { id: 'tortilleria', titulo: 'La Tortillería', personajes: { tortu: { idioma: 'es', sprite: 'spr_tortu' } } },
    jugador: undefined,
    mundo: { pixelesPorMetro: 100, camara: { distanciaEnMetros: 8, alturaEnMetros: 4, giroEnGrados: 0 } },
    estado: { objetivos: [], variables: [], lista: {}, dinero: undefined },
    secuencias: {},
    npcs: {},
    interactivos: {},
    comentarios: {},
    salida: undefined,
  };
  expect(lectura).toEqual({ tipo: 'leido', valor: esperado });
});

test('el jugador y el mundo se leen con sus unidades, y lo que falta toma su valor por defecto', () => {
  const lectura = new LectorDeNivelesDeJson().leerContenido({
    meta: META,
    jugador: { personaje: 'tortu', velocidad: 3 },
    mundo: { pixelesPorMetro: 64, camara: { giro: 20 } },
  });

  if (lectura.tipo !== 'leido') throw new Error(`no se pudo leer: ${lectura.errores.join('; ')}`);
  expect(lectura.valor.jugador).toEqual({ personaje: 'tortu', velocidadEnMetrosPorSegundo: 3 });
  expect(lectura.valor.mundo).toEqual({
    pixelesPorMetro: 64,
    camara: { distanciaEnMetros: 8, alturaEnMetros: 4, giroEnGrados: 20 },
  });
});

test('una línea se convierte con su hablante, traducción, audio y tarjeta de vocabulario', () => {
  const pasos = leerPasos([
    { dice: 'tortu', texto: '¡Cuidado!', trad: 'Careful!', en: 'hot', es: 'caliente', audio: 'vo_tortu_caliente' },
  ]);

  expect(pasos).toEqual([
    {
      tipo: 'linea',
      hablante: 'tortu',
      texto: '¡Cuidado!',
      traduccion: 'Careful!',
      palabra: { en: 'hot', es: 'caliente' },
      audio: 'vo_tortu_caliente',
    },
  ]);
});

test('cada paso corto del JSON se convierte en su forma con "tipo"', () => {
  const pasos = leerPasos([
    { efecto: 'magia' },
    { pon: { globo: 'rosa', dinero: 50, listo: true } },
    { juego: 'Tortilleria', config: { palabras: ['hot'] } },
    { camina: 'frente_tortilleria' },
    { camina: 'frente_tortilleria', quien: 'tortu' },
    { secuencia: 'aun_no_item' },
  ]);

  expect(pasos).toEqual([
    { tipo: 'efecto', nombre: 'magia' },
    { tipo: 'pon', valores: { globo: 'rosa', dinero: 50, listo: true } },
    { tipo: 'juego', nombre: 'Tortilleria', config: { palabras: ['hot'] } },
    { tipo: 'camina', punto: 'frente_tortilleria', personaje: undefined },
    { tipo: 'camina', punto: 'frente_tortilleria', personaje: 'tortu' },
    { tipo: 'secuencia', nombre: 'aun_no_item' },
  ]);
});

test('un condicional lleva su condición ya interpretada y sus pasos de adentro', () => {
  const pasos = leerPasos([{ cuando: 'no tengo tortillas', dice: [{ efecto: 'magia' }] }]);

  expect(pasos).toEqual([
    {
      tipo: 'condicional',
      condicion: { tipo: 'no', condicion: { tipo: 'variable', nombre: 'tortillas' } },
      pasos: [{ tipo: 'efecto', nombre: 'magia' }],
    },
  ]);
});

test('una condición puede ser un texto, una lista (todas) o { "alguno" } (alguna)', () => {
  const pasos = leerPasos([{ cuando: ['globo', { alguno: ['tengo tortillas', 'objetivosCompletos'] }], dice: [] }]);

  expect(pasos).toEqual([
    {
      tipo: 'condicional',
      condicion: {
        tipo: 'todas',
        condiciones: [
          { tipo: 'variable', nombre: 'globo' },
          { tipo: 'alguna', condiciones: [{ tipo: 'variable', nombre: 'tortillas' }, { tipo: 'objetivosCompletos' }] },
        ],
      },
      pasos: [],
    },
  ]);
});

test('una opción lleva sus pasos escritos en el lugar o el nombre de una secuencia', () => {
  const pasos = leerPasos([
    {
      elige: '¿Cuál quieres?',
      opciones: [
        { imagen: 'img_rosa', audio: 'vo_rosa', cuando: 'globo', secuencia: [{ efecto: 'confeti' }] },
        { texto: 'Ninguno', trad: 'None', secuencia: 'despedida' },
      ],
    },
  ]);

  expect(pasos).toEqual([
    {
      tipo: 'elige',
      pregunta: '¿Cuál quieres?',
      opciones: [
        {
          texto: undefined,
          traduccion: undefined,
          imagen: 'img_rosa',
          audio: 'vo_rosa',
          condicion: { tipo: 'variable', nombre: 'globo' },
          alElegir: { tipo: 'pasos', pasos: [{ tipo: 'efecto', nombre: 'confeti' }] },
        },
        {
          texto: 'Ninguno',
          traduccion: 'None',
          imagen: undefined,
          audio: undefined,
          condicion: undefined,
          alElegir: { tipo: 'secuencia', nombre: 'despedida' },
        },
      ],
    },
  ]);
});

test('un campo con el tipo equivocado se reporta con su ruta dentro del archivo', () => {
  const errores = erroresDe({ meta: META, npcs: { tortu: { dialogo: [{ dice: [{ dice: 'tortu', texto: 5 }] }] } } });

  expect(errores).toEqual(['npcs.tortu.dialogo[0].dice[0].texto: Entrada inválida: se esperaba texto, recibido número']);
});

test('una clave que el motor no conoce es un error: así se atrapan los errores de dedo', () => {
  const errores = erroresDe({
    meta: META,
    npcs: { tortu: { dialogo: [{ dice: [{ dice: 'tortu', texto: 'Hola', audioo: 'vo_hola' }] }] } },
    salidas: {},
  });

  expect(errores).toEqual(['npcs.tortu.dialogo[0].dice[0]: Llave desconocida: "audioo"', '(raíz): Llave desconocida: "salidas"']);
});

test('un paso que no se reconoce lista las claves posibles', () => {
  const errores = erroresDe({ meta: META, secuencias: { saludo: [{ grita: '¡Hola!' }] } });

  expect(errores).toEqual([
    'secuencias.saludo[0]: no se reconoce el paso: debe ser un objeto con una de estas claves: ' +
      '"cuando", "elige", "juego", "camina", "secuencia", "efecto", "pon", "dice"',
  ]);
});

test('una tarjeta de vocabulario con solo "en" o solo "es" es un error', () => {
  const errores = erroresDe({ meta: META, secuencias: { saludo: [{ dice: 'tortu', texto: 'Hot!', en: 'hot' }] } });

  expect(errores).toEqual(['secuencias.saludo[0]: una tarjeta de vocabulario necesita "en" y "es" juntos']);
});

test('una condición con otra forma explica cuáles se aceptan', () => {
  const errores = erroresDe({ meta: META, salida: { destino: 'Selector', requiere: 5 } });

  expect(errores).toEqual([
    'salida.requiere: se espera una condición: un texto, una lista de condiciones o { "alguno": [...] }',
  ]);
});

test('donde va una lista de pasos o una secuencia, otra cosa es un error', () => {
  const errores = erroresDe({ meta: META, salida: { destino: 'Selector', siBloqueada: { secuencia: 'x' } } });

  expect(errores).toEqual(['salida.siBloqueada: se espera una lista de pasos o el nombre de una secuencia']);
});

test('el error de un paso dentro de una opción conserva la ruta completa', () => {
  const errores = erroresDe({
    meta: META,
    secuencias: { pregunta: [{ elige: '¿Cuál?', opciones: [{ imagen: 'img_rosa', secuencia: [{ efecto: 7 }] }] }] },
  });

  expect(errores).toEqual([
    'secuencias.pregunta[0].opciones[0].secuencia[0].efecto: Entrada inválida: se esperaba texto, recibido número',
  ]);
});

test('un contenido que no es un objeto se reporta en la raíz', () => {
  expect(erroresDe('hola')).toEqual(['(raíz): Entrada inválida: se esperaba objeto, recibido texto']);
});

test('nivel.json se lee con sus tres rutas', () => {
  const lectura = new LectorDeNivelesDeJson().leerDescripcionDeNivel({
    mapa: 'mapa.tmj',
    contenido: 'contenido.json',
    assets: ['.', '../comun'],
  });

  expect(lectura).toEqual({
    tipo: 'leido',
    valor: { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.', '../comun'] },
  });
});

test('en nivel.json, sin "assets" se usa la carpeta del propio nivel', () => {
  const lectura = new LectorDeNivelesDeJson().leerDescripcionDeNivel({ mapa: 'mapa.tmj', contenido: 'contenido.json' });

  expect(lectura).toEqual({ tipo: 'leido', valor: { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.'] } });
});

test('en nivel.json, una ruta que falta se reporta por su nombre', () => {
  const lectura = new LectorDeNivelesDeJson().leerDescripcionDeNivel({ mapa: 'mapa.tmj' });

  expect(lectura).toEqual({
    tipo: 'invalido',
    errores: ['contenido: Entrada inválida: se esperaba texto, recibido indefinido'],
  });
});
