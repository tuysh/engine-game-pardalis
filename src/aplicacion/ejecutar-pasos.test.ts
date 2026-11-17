import { expect, test } from 'bun:test';
import { leerCondicionDeTexto } from '../dominio/condicion.ts';
import type { AlVolver, Contenido } from '../dominio/contenido.ts';
import { crearEstadoDeNivel, valorDe } from '../dominio/estado.ts';
import type { Paso } from '../dominio/paso.ts';
import type { ResultadoDeMinijuego } from '../puertos/minijuego.ts';
import type { AccionesDePaso } from './acciones-de-paso.ts';
import { ejecutarPasos } from './ejecutar-pasos.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';

const CONTENIDO: Contenido = {
  meta: {
    id: 'barrio',
    titulo: 'El barrio',
    personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' }, tortu: { idioma: 'es', sprite: 'spr_tortu' } },
  },
  jugador: { personaje: 'tommy' },
  estado: { objetivos: ['tortillas'], variables: ['globo'], lista: { tortillas: 'las tortillas' } },
  secuencias: { despedida: [{ tipo: 'linea', hablante: 'tortu', texto: '¡Adiós!' }] },
  npcs: {},
  interactivos: {},
  comentarios: {},
};

/** Lo que las acciones falsas responden cuando el ejecutor les pregunta algo. */
interface Respuestas {
  readonly opcionElegida?: number;
  readonly resultadoDelMinijuego?: ResultadoDeMinijuego;
}

/** Acciones falsas: terminan de inmediato y anotan en `bitacora` lo que se les pidió. */
function crearAccionesFalsas(bitacora: string[], respuestas: Respuestas = {}): AccionesDePaso {
  return {
    async decirLinea(linea, textoCompleto) {
      bitacora.push(`${linea.hablante}: ${textoCompleto}`);
    },
    async elegirOpcion(pregunta, opciones) {
      bitacora.push(`pregunta: ${pregunta} (${opciones.length} opciones)`);
      return respuestas.opcionElegida ?? 0;
    },
    async reproducirEfecto(nombre) {
      bitacora.push(`efecto: ${nombre}`);
    },
    async caminar(personaje, punto) {
      bitacora.push(`${personaje} camina a ${punto}`);
    },
    async jugarMinijuego(nombre) {
      bitacora.push(`minijuego: ${nombre}`);
      return respuestas.resultadoDelMinijuego ?? { exito: true };
    },
  };
}

function crearEstado(): EstadoEnJuego {
  return new EstadoEnJuego(crearEstadoDeNivel(CONTENIDO.estado), () => {});
}

test('los pasos se ejecutan en orden, uno tras otro', async () => {
  const bitacora: string[] = [];
  const pasos: Paso[] = [
    { tipo: 'camina', punto: 'frente', personaje: 'tortu' },
    { tipo: 'linea', hablante: 'tortu', texto: '¡Hola!' },
    { tipo: 'efecto', nombre: 'magia' },
  ];

  await ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    senal: new AbortController().signal,
  });

  expect(bitacora).toEqual(['tortu camina a frente', 'tortu: ¡Hola!', 'efecto: magia']);
});

test('una caminata sin "quien" la hace el personaje del jugador', async () => {
  const bitacora: string[] = [];

  await ejecutarPasos([{ tipo: 'camina', punto: 'frente' }], {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    senal: new AbortController().signal,
  });

  expect(bitacora).toEqual(['tommy camina a frente']);
});

test('el texto de una línea se completa con el estado de ese momento', async () => {
  const bitacora: string[] = [];
  const pasos: Paso[] = [
    { tipo: 'linea', hablante: 'tortu', texto: 'Te faltan {faltan}.' },
    { tipo: 'pon', valores: { tortillas: true } },
    { tipo: 'linea', hablante: 'tortu', texto: 'Te faltan {faltan}.' },
  ];

  await ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    senal: new AbortController().signal,
  });

  expect(bitacora).toEqual(['tortu: Te faltan las tortillas.', 'tortu: Te faltan .']);
});

test('"pon" cambia el estado', async () => {
  const estado = crearEstado();

  await ejecutarPasos([{ tipo: 'pon', valores: { globo: 'rosa' } }], {
    contenido: CONTENIDO,
    estado,
    acciones: crearAccionesFalsas([]),
    senal: new AbortController().signal,
  });

  expect(valorDe(estado.actual, 'globo')).toBe('rosa');
});

test('un condicional solo ejecuta sus pasos si su condición se cumple', async () => {
  const bitacora: string[] = [];
  const pasos: Paso[] = [
    {
      tipo: 'condicional',
      condicion: leerCondicionDeTexto('globo'),
      pasos: [{ tipo: 'linea', hablante: 'tortu', texto: '¡Qué bonito globo!' }],
    },
    {
      tipo: 'condicional',
      condicion: leerCondicionDeTexto('no globo'),
      pasos: [{ tipo: 'linea', hablante: 'tortu', texto: '¿Y tu globo?' }],
    },
  ];

  await ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    senal: new AbortController().signal,
  });

  expect(bitacora).toEqual(['tortu: ¿Y tu globo?']);
});

test('un paso "secuencia" ejecuta los pasos de esa secuencia', async () => {
  const bitacora: string[] = [];

  await ejecutarPasos([{ tipo: 'secuencia', nombre: 'despedida' }], {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    senal: new AbortController().signal,
  });

  expect(bitacora).toEqual(['tortu: ¡Adiós!']);
});

test('al elegir, solo se ofrecen las opciones cuya condición se cumple y se ejecuta la elegida', async () => {
  const bitacora: string[] = [];
  const pasos: Paso[] = [
    {
      tipo: 'elige',
      pregunta: '¿Cuál quieres?',
      opciones: [
        {
          imagen: 'img_escondida',
          condicion: leerCondicionDeTexto('globo'),
          alElegir: { tipo: 'pasos', pasos: [{ tipo: 'efecto', nombre: 'confeti' }] },
        },
        { imagen: 'img_rosa', alElegir: { tipo: 'pasos', pasos: [{ tipo: 'pon', valores: { globo: 'rosa' } }] } },
        { imagen: 'img_adios', alElegir: { tipo: 'secuencia', nombre: 'despedida' } },
      ],
    },
  ];

  await ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado: crearEstado(),
    // La opción 1 de las DOS visibles es la de la despedida: la primera del JSON está escondida.
    acciones: crearAccionesFalsas(bitacora, { opcionElegida: 1 }),
    senal: new AbortController().signal,
  });

  expect(bitacora).toEqual(['pregunta: ¿Cuál quieres? (2 opciones)', 'tortu: ¡Adiós!']);
});

test('si ninguna opción se puede ofrecer, el paso "elige" se salta', async () => {
  const bitacora: string[] = [];
  const pasos: Paso[] = [
    {
      tipo: 'elige',
      pregunta: '¿Cuál quieres?',
      opciones: [{ imagen: 'img', condicion: leerCondicionDeTexto('globo'), alElegir: { tipo: 'pasos', pasos: [] } }],
    },
    { tipo: 'efecto', nombre: 'magia' },
  ];

  await ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    senal: new AbortController().signal,
  });

  expect(bitacora).toEqual(['efecto: magia']);
});

const AL_VOLVER: AlVolver = {
  siLogrado: { tipo: 'pasos', pasos: [{ tipo: 'linea', hablante: 'tommy', texto: 'Thank you!' }] },
  siNo: { tipo: 'pasos', pasos: [{ tipo: 'linea', hablante: 'tortu', texto: '¡Otro día lo intentamos!' }] },
};

test('tras un minijuego con éxito se aplica lo que otorga y sigue "siLogrado"', async () => {
  const bitacora: string[] = [];
  const estado = crearEstado();
  const resultadoDelMinijuego = { exito: true, otorgar: { tortillas: true } };

  await ejecutarPasos([{ tipo: 'juego', nombre: 'Tortilleria', config: undefined }], {
    contenido: CONTENIDO,
    estado,
    acciones: crearAccionesFalsas(bitacora, { resultadoDelMinijuego }),
    senal: new AbortController().signal,
    alVolver: AL_VOLVER,
  });

  expect(valorDe(estado.actual, 'tortillas')).toBe(true);
  expect(bitacora).toEqual(['minijuego: Tortilleria', 'tommy: Thank you!']);
});

test('tras un minijuego sin éxito sigue el diálogo amable "siNo"', async () => {
  const bitacora: string[] = [];

  await ejecutarPasos([{ tipo: 'juego', nombre: 'Tortilleria', config: undefined }], {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora, { resultadoDelMinijuego: { exito: false } }),
    senal: new AbortController().signal,
    alVolver: AL_VOLVER,
  });

  expect(bitacora).toEqual(['minijuego: Tortilleria', 'tortu: ¡Otro día lo intentamos!']);
});

test('un minijuego abierto desde "siLogrado" no vuelve a disparar "alVolver"', async () => {
  const bitacora: string[] = [];
  const alVolverConOtroMinijuego: AlVolver = {
    siLogrado: { tipo: 'pasos', pasos: [{ tipo: 'juego', nombre: 'Fruteria', config: undefined }] },
    siNo: { tipo: 'pasos', pasos: [] },
  };

  await ejecutarPasos([{ tipo: 'juego', nombre: 'Tortilleria', config: undefined }], {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    senal: new AbortController().signal,
    alVolver: alVolverConOtroMinijuego,
  });

  expect(bitacora).toEqual(['minijuego: Tortilleria', 'minijuego: Fruteria']);
});

test('sin "alVolver", después del minijuego sigue el paso siguiente', async () => {
  const bitacora: string[] = [];
  const pasos: Paso[] = [
    { tipo: 'juego', nombre: 'Tortilleria', config: undefined },
    { tipo: 'efecto', nombre: 'magia' },
  ];

  await ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    senal: new AbortController().signal,
  });

  expect(bitacora).toEqual(['minijuego: Tortilleria', 'efecto: magia']);
});

test('al cancelar, termina aunque una acción nunca termine, y no ejecuta los pasos que faltaban', async () => {
  const bitacora: string[] = [];
  const cancelador = new AbortController();
  const acciones = crearAccionesFalsas(bitacora);
  acciones.decirLinea = () => new Promise(() => {}); // una línea que nadie cierra
  const pasos: Paso[] = [
    { tipo: 'linea', hablante: 'tortu', texto: '¡Hola!' },
    { tipo: 'efecto', nombre: 'magia' },
  ];

  const estado = crearEstado();
  const ejecucion = ejecutarPasos(pasos, { contenido: CONTENIDO, estado, acciones, senal: cancelador.signal });
  cancelador.abort();
  await ejecucion;

  expect(bitacora).toEqual([]);
});
