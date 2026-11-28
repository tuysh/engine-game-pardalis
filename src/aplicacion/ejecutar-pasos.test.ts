import { expect, test } from 'bun:test';
import { leerCondicionDeTexto } from '../dominio/condicion.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
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
  jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2.4 },
  mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
  estado: { objetivos: ['tortillas'], variables: ['globo'], lista: { tortillas: 'las tortillas' } },
  secuencias: { despedida: [{ tipo: 'linea', hablante: 'tortu', texto: '¡Adiós!' }] },
  npcs: {},
  interactivos: {},
  cinematicas: {},
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
    colocar(personaje, punto) {
      bitacora.push(`${personaje} queda en ${punto}`);
    },
    async esperar(esperaEnSegundos) {
      bitacora.push(`espera: ${esperaEnSegundos}`);
    },
    async moverCamara(paso) {
      bitacora.push(`cámara viaja a ${paso.destino} en ${paso.duracionEnSegundos}`);
    },
    cortarCamara(destino) {
      bitacora.push(`cámara corta a ${destino}`);
    },
    mirar(paso) {
      bitacora.push(`${paso.personaje} mira a ${paso.hacia}`);
    },
    async animar(paso) {
      bitacora.push(`${paso.personaje} se anima con ${paso.clave}`);
    },
    async aparecer(paso) {
      bitacora.push(`${paso.personaje} aparece en ${paso.punto}`);
    },
    desaparecer(personaje) {
      bitacora.push(`${personaje} desaparece`);
    },
    ponerMusica(clave) {
      bitacora.push(`música: ${clave}`);
    },
    tocarSonido(clave) {
      bitacora.push(`sonido: ${clave}`);
    },
    async fundir(paso) {
      bitacora.push(`fundido: ${paso.sentido} en ${paso.duracionEnSegundos}`);
    },
    dejarFundido(sentido) {
      bitacora.push(`fundido ya: ${sentido}`);
    },
    async reproducirVideo(clavePorIdioma) {
      bitacora.push(`video: ${clavePorIdioma.es}`);
    },
    pedirSalida(destino) {
      bitacora.push(`sale: ${destino}`);
    },
    cambiarAcompanante(personaje) {
      bitacora.push(`acompaña: ${personaje ?? 'nadie'}`);
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

test('una línea muestra el número de una variable y una condición reacciona al texto que guarda otra', async () => {
  const bitacora: string[] = [];
  const pasos: Paso[] = [
    { tipo: 'pon', valores: { globo: { suma: 3 } } },
    { tipo: 'linea', hablante: 'tortu', texto: 'Llevas {globo} globos.' },
    { tipo: 'pon', valores: { globo: 'rosa' } },
    { tipo: 'condicional', condicion: leerCondicionDeTexto('globo = azul'), pasos: [] },
    {
      tipo: 'condicional',
      condicion: leerCondicionDeTexto('globo = rosa'),
      pasos: [{ tipo: 'linea', hablante: 'tortu', texto: '¡Qué bonito tu globo rosa!' }],
    },
  ];

  await ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    senal: new AbortController().signal,
  });

  expect(bitacora).toEqual(['tortu: Llevas 3 globos.', 'tortu: ¡Qué bonito tu globo rosa!']);
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

test('"pon" puede sumar y restar al número que la variable tiene en ese momento', async () => {
  const estado = crearEstado();
  const pasos: Paso[] = [
    { tipo: 'pon', valores: { dinero: 100 } },
    { tipo: 'pon', valores: { dinero: { resta: 10 }, estrellas: { suma: 1 } } },
    { tipo: 'pon', valores: { estrellas: { suma: 1 } } },
  ];

  await ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado,
    acciones: crearAccionesFalsas([]),
    senal: new AbortController().signal,
  });

  expect(valorDe(estado.actual, 'dinero')).toBe(90);
  expect(valorDe(estado.actual, 'estrellas')).toBe(2);
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

test('tras un minijuego con éxito sigue "siLogrado"', async () => {
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

  // Lo que otorga lo aplica la acción `jugarMinijuego` (ver jugar-minijuego.test.ts), no el ejecutor:
  // así no se aplica dos veces.
  expect(valorDe(estado.actual, 'tortillas')).toBeUndefined();
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

test('los pasos de escena piden su acción, en orden', async () => {
  const bitacora: string[] = [];
  const pasos: Paso[] = [
    { tipo: 'fundido', sentido: 'abrir', duracionEnSegundos: 1 },
    { tipo: 'camara', destino: 'plano_sala', duracionEnSegundos: 2 },
    { tipo: 'aparece', personaje: 'tortu', punto: 'puerta' },
    { tipo: 'mira', personaje: 'tommy', hacia: 'tortu' },
    { tipo: 'anima', personaje: 'tommy', clave: 'tommy_saluda', repite: false },
    { tipo: 'espera', esperaEnSegundos: 2 },
    { tipo: 'musica', clave: 'mus_barrio' },
    { tipo: 'sonido', clave: 'puerta_abre' },
    { tipo: 'video', clavePorIdioma: { es: 'intro_es', en: 'intro_en' } },
    { tipo: 'desaparece', personaje: 'tortu' },
    { tipo: 'sale', destino: 'barrio' },
    { tipo: 'acompana', personaje: 'tortu' },
    { tipo: 'acompana' },
  ];

  await ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    senal: new AbortController().signal,
  });

  expect(bitacora).toEqual([
    'fundido: abrir en 1',
    'cámara viaja a plano_sala en 2',
    'tortu aparece en puerta',
    'tommy mira a tortu',
    'tommy se anima con tommy_saluda',
    'espera: 2',
    'música: mus_barrio',
    'sonido: puerta_abre',
    'video: intro_es',
    'tortu desaparece',
    'sale: barrio',
    'acompaña: tortu',
    'acompaña: nadie',
  ]);
});

test('los pasos de "juntos" empiezan a la vez y el siguiente espera a que todos terminen', async () => {
  const bitacora: string[] = [];
  const acciones = crearAccionesFalsas(bitacora);
  let terminarLaCaminata = (): void => {};
  acciones.caminar = (personaje) => {
    bitacora.push(`${personaje} empieza a caminar`);
    return new Promise((terminar) => {
      terminarLaCaminata = terminar;
    });
  };
  const pasos: Paso[] = [
    {
      tipo: 'juntos',
      pasos: [
        { tipo: 'camina', punto: 'frente', personaje: 'tortu' },
        { tipo: 'sonido', clave: 'pasos' },
      ],
    },
    { tipo: 'efecto', nombre: 'magia' },
  ];

  const ejecucion = ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones,
    senal: new AbortController().signal,
  });
  await Promise.resolve();
  // El sonido ya sonó aunque la caminata no ha terminado; el efecto todavía espera.
  expect(bitacora).toEqual(['tortu empieza a caminar', 'sonido: pasos']);

  terminarLaCaminata();
  await ejecucion;
  expect(bitacora).toEqual(['tortu empieza a caminar', 'sonido: pasos', 'efecto: magia']);
});

test('al saltar una escena, lo que solo se ve o se oye se omite y lo demás deja su resultado final', async () => {
  const bitacora: string[] = [];
  const estado = crearEstado();
  const pasos: Paso[] = [
    { tipo: 'linea', hablante: 'tortu', texto: '¡Hola!' },
    { tipo: 'efecto', nombre: 'magia' },
    { tipo: 'espera', esperaEnSegundos: 2 },
    { tipo: 'sonido', clave: 'puerta_abre' },
    { tipo: 'video', clavePorIdioma: { es: 'intro', en: 'intro' } },
    { tipo: 'anima', personaje: 'tommy', clave: 'tommy_saluda', repite: false },
    { tipo: 'camina', punto: 'frente', personaje: 'tortu' },
    { tipo: 'camara', destino: 'plano_sala', duracionEnSegundos: 2 },
    { tipo: 'fundido', sentido: 'cerrar', duracionEnSegundos: 1 },
    { tipo: 'anima', personaje: 'tommy', clave: 'tommy_sentado', repite: true },
    { tipo: 'aparece', personaje: 'tortu', punto: 'puerta' },
    { tipo: 'mira', personaje: 'tommy', hacia: 'tortu' },
    { tipo: 'pon', valores: { globo: 'rosa' } },
    { tipo: 'musica', clave: 'mus_barrio' },
    { tipo: 'sale', destino: 'barrio' },
  ];
  const cancelador = new AbortController();
  cancelador.abort();

  await ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado,
    acciones: crearAccionesFalsas(bitacora),
    senal: cancelador.signal,
    seEstaSaltando: () => true,
  });

  expect(bitacora).toEqual([
    'tortu queda en frente',
    'cámara corta a plano_sala',
    'fundido ya: cerrar',
    'tommy se anima con tommy_sentado',
    'tortu aparece en puerta',
    'tommy mira a tortu',
    'música: mus_barrio',
    'sale: barrio',
  ]);
  expect(valorDe(estado.actual, 'globo')).toBe('rosa');
});

test('si la escena se salta a media caminata, el personaje queda en su destino y siguen los pasos que faltan', async () => {
  const bitacora: string[] = [];
  const cancelador = new AbortController();
  let seSalto = false;
  const acciones = crearAccionesFalsas(bitacora);
  acciones.caminar = () => new Promise(() => {}); // una caminata que nunca llega
  const pasos: Paso[] = [
    { tipo: 'camina', punto: 'frente', personaje: 'tortu' },
    { tipo: 'linea', hablante: 'tortu', texto: '¡Ya llegué!' },
    { tipo: 'aparece', personaje: 'tommy', punto: 'puerta' },
  ];

  const ejecucion = ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones,
    senal: cancelador.signal,
    seEstaSaltando: () => seSalto,
  });
  seSalto = true;
  cancelador.abort();
  await ejecucion;

  expect(bitacora).toEqual(['tortu queda en frente', 'tommy aparece en puerta']);
});

test('en una escena que se salta no se pregunta nada ni se abre un minijuego', async () => {
  const bitacora: string[] = [];
  const pasos: Paso[] = [
    { tipo: 'elige', pregunta: '¿Cuál?', opciones: [{ imagen: 'img', alElegir: { tipo: 'pasos', pasos: [] } }] },
    { tipo: 'juego', nombre: 'Tortilleria', config: undefined },
    { tipo: 'musica', clave: 'mus_barrio' },
  ];
  const cancelador = new AbortController();
  cancelador.abort();

  await ejecutarPasos(pasos, {
    contenido: CONTENIDO,
    estado: crearEstado(),
    acciones: crearAccionesFalsas(bitacora),
    senal: cancelador.signal,
    seEstaSaltando: () => true,
  });

  expect(bitacora).toEqual(['música: mus_barrio']);
});
