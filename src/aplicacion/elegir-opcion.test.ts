import { expect, test } from 'bun:test';
import { AudioDeMemoria } from '../adaptadores/memoria/audio-de-memoria.ts';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { InterfazDeMemoria } from '../adaptadores/memoria/interfaz-de-memoria.ts';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import { crearEstadoDeNivel } from '../dominio/estado.ts';
import type { Opcion } from '../dominio/paso.ts';
import { elegirOpcion } from './elegir-opcion.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';
import { Reparto } from './reparto.ts';

const OPCIONES: Opcion[] = [
  { imagen: 'img_rosa', texto: 'El rosa', audio: 'vo_rosa', alElegir: { tipo: 'pasos', pasos: [] } },
  { imagen: 'img_azul', texto: 'El azul', alElegir: { tipo: 'pasos', pasos: [] } },
];

/** Los adaptadores falsos de una escena en español. */
function crearEscena() {
  const escenario = new EscenarioDeMemoria();
  const interfaz = new InterfazDeMemoria();
  const audio = new AudioDeMemoria();
  const piezas: PiezasDeEscena = {
    contenido: {
      meta: { id: 'barrio', titulo: 'El barrio', personajes: {} },
      mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
      estado: { objetivos: [], variables: [], lista: {} },
      secuencias: {},
      npcs: {},
      interactivos: {},
      cinematicas: {},
      comentarios: {},
    },
    puntos: {},
    centroDelLugar: { x: 5, y: 2 },
    idiomaBase: 'es',
    escenario,
    interfaz,
    audio,
    reloj: new RelojDeMemoria(),
    reparto: new Reparto(escenario),
    estado: new EstadoEnJuego(crearEstadoDeNivel({ objetivos: [], variables: [], lista: {} }), () => {}),
    minijuegos: {},
    direccionDeAsset: (clave) => `/assets/${clave}`,
    azar: () => 0,
    alVerPalabra: () => {},
    alEmpezarMinijuego: () => {},
    alTerminarMinijuego: () => {},
  };
  return { piezas, interfaz, audio };
}

/** Deja que corra el código que estaba detenido en un `await`. */
function darTurno(): Promise<void> {
  return new Promise((continuar) => setTimeout(continuar, 0));
}

const SIN_INTERRUMPIR = new AbortController().signal;

test('muestra la pregunta y una tarjeta por opción, con la dirección de su imagen', () => {
  const { piezas, interfaz } = crearEscena();

  void elegirOpcion({ pregunta: '¿Cuál quieres?', opciones: OPCIONES }, SIN_INTERRUMPIR, piezas);

  expect(interfaz.opciones).toEqual({
    pregunta: '¿Cuál quieres?',
    opciones: [
      { texto: 'El rosa', traduccion: undefined, direccionDeLaImagen: '/assets/img_rosa' },
      { texto: 'El azul', traduccion: undefined, direccionDeLaImagen: '/assets/img_azul' },
    ],
  });
});

test('devuelve la posición de la tarjeta que tocó el jugador y quita las opciones', async () => {
  const { piezas, interfaz, audio } = crearEscena();

  const eleccion = elegirOpcion({ pregunta: '¿Cuál quieres?', opciones: OPCIONES }, SIN_INTERRUMPIR, piezas);
  interfaz.simularEleccion(1);

  expect(await eleccion).toBe(1);
  expect(interfaz.opciones).toBeUndefined();
  expect(interfaz.hayQuienEscuchaToques).toBe(false);
  expect(audio.hayAlguienHablando).toBe(false);
});

test('lee en voz alta la pregunta y luego cada opción, resaltando la que dice', async () => {
  const { piezas, interfaz, audio } = crearEscena();

  void elegirOpcion({ pregunta: '¿Cuál quieres?', opciones: OPCIONES }, SIN_INTERRUMPIR, piezas);
  audio.terminarDeHablar(); // termina la pregunta
  await darTurno();
  audio.terminarDeHablar(); // termina "El rosa"
  await darTurno();
  audio.terminarDeHablar(); // termina "El azul"
  await darTurno();

  expect(audio.frasesDichas).toEqual([
    { texto: '¿Cuál quieres?', idioma: 'es' },
    { texto: 'El rosa', idioma: 'es', direccionDeLaVoz: '/assets/vo_rosa' },
    { texto: 'El azul', idioma: 'es', direccionDeLaVoz: undefined },
  ]);
  expect(interfaz.opcionesResaltadas).toEqual([0, 1, undefined]);
  // Después de leerlas, las opciones siguen en pantalla esperando al jugador.
  expect(interfaz.opciones).toBeDefined();
});

test('una posición que no existe se ignora y se sigue esperando', async () => {
  const { piezas, interfaz } = crearEscena();

  const eleccion = elegirOpcion({ pregunta: '¿Cuál quieres?', opciones: OPCIONES }, SIN_INTERRUMPIR, piezas);
  interfaz.simularEleccion(7);
  await darTurno();
  expect(interfaz.opciones).toBeDefined();
  interfaz.simularEleccion(0);

  expect(await eleccion).toBe(0);
});

test('al interrumpir el diálogo, termina sin elección y no deja nada en pantalla', async () => {
  const { piezas, interfaz, audio } = crearEscena();
  const interrupcion = new AbortController();

  const eleccion = elegirOpcion({ pregunta: '¿Cuál quieres?', opciones: OPCIONES }, interrupcion.signal, piezas);
  interrupcion.abort();

  expect(await eleccion).toBe(-1);
  expect(interfaz.opciones).toBeUndefined();
  expect(audio.hayAlguienHablando).toBe(false);
});
