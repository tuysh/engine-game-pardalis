import { expect, test } from 'bun:test';
import { crearMapaDeCaminos } from '../dominio/rejilla-de-caminos.ts';
import { AudioDeMemoria } from '../adaptadores/memoria/audio-de-memoria.ts';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { InterfazDeMemoria } from '../adaptadores/memoria/interfaz-de-memoria.ts';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import type { Jugador } from '../dominio/contenido.ts';
import { crearEstadoDeNivel } from '../dominio/estado.ts';
import type { ImagenDeEscena } from '../puertos/escenario.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';
import { reproducirEfecto } from './reproducir-efecto.ts';
import { Reparto } from './reparto.ts';

const IMAGEN: ImagenDeEscena = {
  direcciones: ['spr.svg'],
  cuadrosPorSegundo: 0,
  anchoEnPixeles: 90,
  altoEnPixeles: 160,
  anchoEnMetros: 0.9,
  altoEnMetros: 1.6,
};

/** Una escena con adaptadores falsos. Si se da un jugador, su personaje ya está parado en (2, 3). */
async function crearEscena(jugador?: Jugador) {
  const escenario = new EscenarioDeMemoria();
  const audio = new AudioDeMemoria();
  const reloj = new RelojDeMemoria();
  const reparto = new Reparto(escenario);
  if (jugador !== undefined) {
    await reparto.agregar({ id: jugador.personaje, imagen: IMAGEN, posicion: { x: 2, y: 3 }, mira: 'derecha', sePuedeTocar: false });
  }
  const piezas: PiezasDeEscena = {
    contenido: {
      meta: { id: 'barrio', titulo: 'El barrio', personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' } } },
      jugador,
      mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
      estado: { objetivos: [], variables: [], lista: {} },
      secuencias: {},
      npcs: {},
      interactivos: {},
      cinematicas: {},
      comentarios: {},
    },
    caminos: crearMapaDeCaminos({ pisos: [], obstaculos: [] }),
    puntos: {},
    centroDelLugar: { x: 5, y: 2 },
    idiomaBase: 'es',
    escenario,
    interfaz: new InterfazDeMemoria(),
    audio,
    reloj,
    reparto,
    estado: new EstadoEnJuego(crearEstadoDeNivel({ objetivos: [], variables: [], lista: {} }), () => {}),
    minijuegos: {},
    direccionDeAsset: () => undefined,
    azar: () => 0,
    imagenDeAsset: (clave) => ({
      direcciones: [`/img/${clave}.svg`],
      cuadrosPorSegundo: 0,
      anchoEnPixeles: 90,
      altoEnPixeles: 160,
      anchoEnMetros: 0.9,
      altoEnMetros: 1.6,
    }),
    alVerPalabra: () => {},
    alEmpezarMinijuego: () => {},
    alTerminarMinijuego: () => {},
  };
  return { piezas, escenario, audio, reloj };
}

const SIN_INTERRUMPIR = new AbortController().signal;
const TOMMY: Jugador = { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2 };

test('el efecto aparece sobre el jugador', async () => {
  const { piezas, escenario } = await crearEscena(TOMMY);

  void reproducirEfecto('magia', SIN_INTERRUMPIR, piezas);

  expect(escenario.efectosReproducidos).toEqual([{ nombre: 'magia', punto: { x: 2, y: 3 } }]);
});

test('en un nivel sin jugador, el efecto aparece en el centro del lugar', async () => {
  const { piezas, escenario } = await crearEscena();

  void reproducirEfecto('confeti', SIN_INTERRUMPIR, piezas);

  expect(escenario.efectosReproducidos).toEqual([{ nombre: 'confeti', punto: { x: 5, y: 2 } }]);
});

test('"magia" toca tres notas que suben, una tras otra', async () => {
  const { piezas, audio, reloj } = await crearEscena(TOMMY);

  void reproducirEfecto('magia', SIN_INTERRUMPIR, piezas);
  await reloj.avanzar(0.05);
  expect(audio.tonosTocados).toEqual([660]);
  await reloj.avanzar(0.3);

  expect(audio.tonosTocados).toEqual([660, 880, 1320]);
});

test('el efecto termina al segundo de empezar', async () => {
  const { piezas, reloj } = await crearEscena(TOMMY);
  let termino = false;

  void reproducirEfecto('confeti', SIN_INTERRUMPIR, piezas).then(() => {
    termino = true;
  });
  await reloj.avanzar(0.9);
  expect(termino).toBe(false);
  await reloj.avanzar(0.2);

  expect(termino).toBe(true);
});

test('al interrumpir, termina enseguida y ya no toca las notas que faltaban', async () => {
  const { piezas, audio, reloj } = await crearEscena(TOMMY);
  const interrupcion = new AbortController();

  const efecto = reproducirEfecto('magia', interrupcion.signal, piezas);
  await reloj.avanzar(0.05);
  interrupcion.abort();
  await efecto;
  await reloj.avanzar(1);

  expect(audio.tonosTocados).toEqual([660]);
  expect(reloj.hayEsperasPendientes).toBe(false);
});
