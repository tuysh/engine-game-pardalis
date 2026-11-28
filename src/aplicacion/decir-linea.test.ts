import { expect, test } from 'bun:test';
import { crearMapaDeCaminos } from '../dominio/rejilla-de-caminos.ts';
import { AudioDeMemoria } from '../adaptadores/memoria/audio-de-memoria.ts';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { InterfazDeMemoria } from '../adaptadores/memoria/interfaz-de-memoria.ts';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import type { Contenido, Personaje } from '../dominio/contenido.ts';
import { crearEstadoDeNivel } from '../dominio/estado.ts';
import type { PalabraDeVocabulario, PasoDeLinea } from '../dominio/paso.ts';
import type { ImagenDeEscena } from '../puertos/escenario.ts';
import { decirLinea } from './decir-linea.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';
import { Reparto } from './reparto.ts';
import { VocesDelNivel } from './voces-del-nivel.ts';
import { VozEnOrden } from './voz-en-orden.ts';

const CONTENIDO: Contenido = {
  meta: {
    id: 'barrio',
    titulo: 'El barrio',
    personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' }, tortu: { idioma: 'es', sprite: 'spr_tortu' } },
  },
  mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
  estado: { objetivos: [], variables: [], lista: {} },
  secuencias: {},
  npcs: {},
  interactivos: {},
  cinematicas: {},
  comentarios: {},
};

const IMAGEN: ImagenDeEscena = {
  direcciones: ['spr.svg'],
  cuadrosPorSegundo: 0,
  anchoEnPixeles: 100,
  altoEnPixeles: 170,
  anchoEnMetros: 1,
  altoEnMetros: 1.7,
};

/** Los adaptadores falsos de una escena en español, con Doña Tortu parada en (5, 2). */
async function crearEscena() {
  const escenario = new EscenarioDeMemoria();
  const interfaz = new InterfazDeMemoria();
  const audio = new AudioDeMemoria();
  const reloj = new RelojDeMemoria();
  const reparto = new Reparto(escenario);
  await reparto.agregar({ id: 'tortu', imagen: IMAGEN, posicion: { x: 5, y: 2 }, mira: 'izquierda', sePuedeTocar: true });
  const palabrasVistas: PalabraDeVocabulario[] = [];

  const piezas: PiezasDeEscena = {
    contenido: CONTENIDO,
    caminos: crearMapaDeCaminos({ pisos: [], obstaculos: [] }),
    puntos: {},
    centroDelLugar: { x: 5, y: 2 },
    idiomaBase: 'es',
    escenario,
    interfaz,
    audio,
    reloj,
    reparto,
    estado: new EstadoEnJuego(crearEstadoDeNivel({ objetivos: [], variables: [], lista: {} }), () => {}),
    minijuegos: {},
    direccionDeAsset: (clave) => (clave === 'vo_tortu_hola' ? '/voz/vo_tortu_hola.mp3' : undefined),
    cuadrosDeAsset: () => undefined,
    voces: new VocesDelNivel({ personajes: {}, direccionDeAsset: () => undefined }),
    azar: () => 0,
    imagenDeAsset: (clave) => ({
      direcciones: [`/img/${clave}.svg`],
      cuadrosPorSegundo: 0,
      anchoEnPixeles: 90,
      altoEnPixeles: 160,
      anchoEnMetros: 0.9,
      altoEnMetros: 1.6,
    }),
    alVerPalabra: (palabra) => palabrasVistas.push(palabra),
    alEmpezarMinijuego: () => {},
    alTerminarMinijuego: () => {},
  };
  return { piezas, interfaz, audio, reloj, reparto, palabrasVistas, escenario };
}

const SIN_INTERRUMPIR = new AbortController().signal;
const HOLA: PasoDeLinea = { tipo: 'linea', hablante: 'tortu', texto: '¡Hola!', audio: 'vo_tortu_hola' };

test('muestra el globo sobre quien habla y dice el texto con su voz grabada', async () => {
  const { piezas, interfaz, audio } = await crearEscena();

  void decirLinea({ paso: HOLA, textoCompleto: '¡Hola!', seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas);

  expect(interfaz.globo).toEqual({ texto: '¡Hola!', traduccion: undefined, palabra: undefined });
  expect(interfaz.lugarDelGlobo).toEqual({ x: 5, y: 2 });
  expect(audio.frasesDichas).toEqual([{ texto: '¡Hola!', idioma: 'es', direccionDeLaVoz: '/voz/vo_tortu_hola.mp3' }]);
});

test('un toque cierra la línea: se quita el globo y se calla la voz', async () => {
  const { piezas, interfaz, audio, reloj } = await crearEscena();

  const linea = decirLinea({ paso: HOLA, textoCompleto: '¡Hola!', seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas);
  await reloj.avanzar(0.5);
  interfaz.simularToqueParaSeguir();
  await linea;

  expect(interfaz.globo).toBeUndefined();
  expect(audio.hayAlguienHablando).toBe(false);
  expect(interfaz.hayQuienEscuchaToques).toBe(false);
});

test('un toque que llega apenas empieza la línea no la cierra: un doble toque no se salta lo que se dice', async () => {
  const { piezas, interfaz, audio, reloj } = await crearEscena();
  let termino = false;

  void decirLinea({ paso: HOLA, textoCompleto: '¡Hola!', seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas).then(() => {
    termino = true;
  });
  await reloj.avanzar(0.1);
  interfaz.simularToqueParaSeguir();
  await reloj.avanzar(0);

  expect(termino).toBe(false);
  expect(interfaz.globo?.texto).toBe('¡Hola!');
  expect(audio.hayAlguienHablando).toBe(true);
  // El toque temprano sigue atrapado por la capa de toque: no se va al mapa.
  expect(interfaz.hayQuienEscuchaToques).toBe(true);

  await reloj.avanzar(0.5);
  interfaz.simularToqueParaSeguir();
  await reloj.avanzar(0);

  expect(termino).toBe(true);
  expect(interfaz.globo).toBeUndefined();
});

test('si nadie toca, la línea se cierra sola un momento después de que termina la voz', async () => {
  const { piezas, interfaz, audio, reloj } = await crearEscena();
  let termino = false;

  void decirLinea({ paso: HOLA, textoCompleto: '¡Hola!', seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas).then(() => {
    termino = true;
  });
  audio.terminarDeHablar();
  await reloj.avanzar(0.5);
  expect(termino).toBe(false);
  await reloj.avanzar(0.3);

  expect(termino).toBe(true);
  expect(interfaz.globo).toBeUndefined();
});

test('al interrumpir el diálogo, la línea termina y no deja nada en pantalla', async () => {
  const { piezas, interfaz, reloj } = await crearEscena();
  const interrupcion = new AbortController();

  const linea = decirLinea({ paso: HOLA, textoCompleto: '¡Hola!', seCierraConUnToque: true }, interrupcion.signal, piezas);
  interrupcion.abort();
  await linea;

  expect(interfaz.globo).toBeUndefined();
  expect(interfaz.hayQuienEscuchaToques).toBe(false);
  expect(reloj.hayEsperasPendientes).toBe(false);
});

test('el globo sigue a quien habla cuando se mueve', async () => {
  const { piezas, interfaz, reloj, reparto } = await crearEscena();

  void decirLinea({ paso: HOLA, textoCompleto: '¡Hola!', seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas);
  reparto.mover('tortu', { x: 6, y: 3 });
  await reloj.avanzar(0.016);

  expect(interfaz.lugarDelGlobo).toEqual({ x: 6, y: 3 });
});

test('la traducción se muestra y se dice solo si el personaje habla otro idioma que el del sitio', async () => {
  const { piezas, interfaz, audio, reloj } = await crearEscena();
  const gracias: PasoDeLinea = { tipo: 'linea', hablante: 'tommy', texto: 'Thank you!', traduccion: '¡Gracias!' };

  void decirLinea({ paso: gracias, textoCompleto: 'Thank you!', seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas);
  expect(interfaz.globo?.traduccion).toBe('¡Gracias!');
  audio.terminarDeHablar();
  // La segunda frase se pide después de que la primera termina de resolverse: se le da turno a ese código.
  await reloj.avanzar(0.01);

  expect(audio.frasesDichas).toEqual([
    { texto: 'Thank you!', idioma: 'en', direccionDeLaVoz: undefined },
    { texto: '¡Gracias!', idioma: 'es' },
  ]);
});

test('la traducción de alguien que habla el idioma del sitio se ignora', async () => {
  const { piezas, interfaz } = await crearEscena();
  const linea: PasoDeLinea = { tipo: 'linea', hablante: 'tortu', texto: '¡Hola!', traduccion: 'Hello!' };

  void decirLinea({ paso: linea, textoCompleto: '¡Hola!', seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas);

  expect(interfaz.globo?.traduccion).toBeUndefined();
});

test('una línea con vocabulario muestra la tarjeta y avisa de la palabra', async () => {
  const { piezas, interfaz, palabrasVistas } = await crearEscena();
  const linea: PasoDeLinea = { tipo: 'linea', hablante: 'tortu', texto: '¡Está caliente!', palabra: { en: 'hot', es: 'caliente' } };

  void decirLinea({ paso: linea, textoCompleto: '¡Está caliente!', seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas);

  expect(interfaz.globo?.palabra).toEqual({ en: 'hot', es: 'caliente' });
  expect(palabrasVistas).toEqual([{ en: 'hot', es: 'caliente' }]);
});

test('en un dispositivo sin voz, el globo se queda el tiempo que tomaría leerlo', async () => {
  const { piezas, interfaz, audio, reloj } = await crearEscena();
  audio.resultadoAlDecir = 'sin_voz';
  const textoDeCincuentaLetras = 'a'.repeat(50);
  const linea: PasoDeLinea = { tipo: 'linea', hablante: 'tortu', texto: textoDeCincuentaLetras };

  void decirLinea({ paso: linea, textoCompleto: textoDeCincuentaLetras, seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas);
  await reloj.avanzar(2.9);
  expect(interfaz.globo).toBeDefined();
  await reloj.avanzar(0.2);

  // 50 letras × 0.06 segundos = 3 segundos.
  expect(interfaz.globo).toBeUndefined();
});

test('si la voz sintetizada nunca avisa que terminó, la línea se cierra sola al pasar un tiempo holgado', async () => {
  const escena = await crearEscena();
  const { interfaz, audio, reloj } = escena;
  // El tope de tiempo lo pone la fila de voces, como en el juego (crear.ts).
  const piezas: PiezasDeEscena = { ...escena.piezas, audio: new VozEnOrden(audio, reloj) };
  const sinVozGrabada: PasoDeLinea = { tipo: 'linea', hablante: 'tortu', texto: '¡Hola!' };
  let termino = false;

  void decirLinea({ paso: sinVozGrabada, textoCompleto: '¡Hola!', seCierraConUnToque: false }, SIN_INTERRUMPIR, piezas).then(
    () => {
      termino = true;
    },
  );
  // La prueba nunca llama a `audio.terminarDeHablar()`: es una voz que se queda «hablando» para siempre.
  await reloj.avanzar(5);
  expect(termino).toBe(false);
  await reloj.avanzar(1.1); // se cumple el tope de 6 segundos: la voz se calla
  await reloj.avanzar(0.8); // y pasa la pausa de siempre antes de cerrar el globo

  expect(termino).toBe(true);
  expect(interfaz.globo).toBeUndefined();
  expect(audio.hayAlguienHablando).toBe(false);
});

test('una voz grabada se espera completa, dure lo que dure', async () => {
  const { piezas, interfaz, audio, reloj } = await crearEscena();

  void decirLinea({ paso: HOLA, textoCompleto: '¡Hola!', seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas);
  await reloj.avanzar(60);

  expect(interfaz.globo).toBeDefined();
  expect(audio.hayAlguienHablando).toBe(true);
});

test('con una pose, quien habla cambia de dibujo mientras dura la línea y al terminar vuelve al que tenía', async () => {
  const { piezas, interfaz, escenario, reloj } = await crearEscena();
  const sorpresa: PasoDeLinea = { tipo: 'linea', hablante: 'tortu', texto: '¡Ay!', pose: 'tortu_sorpresa' };

  const linea = decirLinea({ paso: sorpresa, textoCompleto: '¡Ay!', seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas);
  expect(escenario.dibujos.get('tortu')?.imagen.direcciones).toEqual(['/img/tortu_sorpresa.svg']);

  await reloj.avanzar(0.5);
  interfaz.simularToqueParaSeguir();
  await linea;

  expect(escenario.dibujos.get('tortu')).toEqual({ imagen: IMAGEN, repite: true });
});

test('quien escucha puede reaccionar con otro dibujo, y quien no está en el escenario no cambia nada', async () => {
  const { piezas, interfaz, escenario, reparto, reloj } = await crearEscena();
  // Tommy sí está en el escenario y escucha; "pancho" no está.
  await reparto.agregar({ id: 'tommy', imagen: IMAGEN, posicion: { x: 3, y: 2 }, mira: 'derecha', sePuedeTocar: false });
  const linea: PasoDeLinea = {
    tipo: 'linea',
    hablante: 'tortu',
    texto: '¡Hola!',
    reacciones: { tommy: 'tommy_feliz', pancho: 'pancho_feliz' },
  };

  const dicha = decirLinea({ paso: linea, textoCompleto: '¡Hola!', seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas);
  expect(escenario.dibujos.get('tommy')?.imagen.direcciones).toEqual(['/img/tommy_feliz.svg']);
  expect(escenario.dibujos.has('pancho')).toBe(false);
  expect(escenario.dibujos.has('tortu')).toBe(false);

  await reloj.avanzar(0.5);
  interfaz.simularToqueParaSeguir();
  await dicha;

  expect(escenario.dibujos.get('tommy')).toEqual({ imagen: IMAGEN, repite: true });
});

test('si la línea se interrumpe, quien tenía una pose también vuelve a su dibujo', async () => {
  const { piezas, escenario } = await crearEscena();
  const interrupcion = new AbortController();
  const sorpresa: PasoDeLinea = { tipo: 'linea', hablante: 'tortu', texto: '¡Ay!', pose: 'tortu_sorpresa' };

  const linea = decirLinea({ paso: sorpresa, textoCompleto: '¡Ay!', seCierraConUnToque: true }, interrupcion.signal, piezas);
  interrupcion.abort();
  await linea;

  expect(escenario.dibujos.get('tortu')).toEqual({ imagen: IMAGEN, repite: true });
});

test('un pensamiento se muestra en un globo de pensamiento', async () => {
  const { piezas, interfaz } = await crearEscena();
  const duda: PasoDeLinea = { tipo: 'linea', hablante: 'tortu', texto: '¿Y si llueve?', esPensamiento: true };

  void decirLinea({ paso: duda, textoCompleto: '¿Y si llueve?', seCierraConUnToque: true }, SIN_INTERRUMPIR, piezas);

  expect(interfaz.globo?.esPensamiento).toBe(true);
});

test('la frase lleva el tono y la velocidad de quien habla; su traducción se dice con la voz normal', async () => {
  const { piezas, audio } = await crearEscena();
  const personajes: Record<string, Personaje> = {
    tortu: { idioma: 'es', sprite: 'spr_tortu' },
    bobby: { idioma: 'en', sprite: 'spr_bobby', voz: { tono: 1.3, velocidad: 1.05 } },
  };
  const conBobby = { ...piezas, contenido: { ...CONTENIDO, meta: { ...CONTENIDO.meta, personajes } } };
  const paso: PasoDeLinea = { tipo: 'linea', hablante: 'bobby', texto: 'Corn!', traduccion: '¡Maíz!' };

  void decirLinea({ paso, textoCompleto: 'Corn!', seCierraConUnToque: true }, SIN_INTERRUMPIR, conBobby);
  audio.terminarDeHablar();
  await new Promise((seguir) => setTimeout(seguir, 0));

  expect(audio.frasesDichas).toEqual([
    { texto: 'Corn!', idioma: 'en', direccionDeLaVoz: undefined, voz: { tono: 1.3, velocidad: 1.05 } },
    { texto: '¡Maíz!', idioma: 'es' },
  ]);
});
