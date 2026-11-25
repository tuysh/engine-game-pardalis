import { expect, test } from 'bun:test';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import type { Contenido } from '../dominio/contenido.ts';
import type { ImagenDeEscena } from '../puertos/escenario.ts';
import { CamaraDeEscena } from './camara-de-escena.ts';
import { Reparto } from './reparto.ts';

const IMAGEN: ImagenDeEscena = {
  direcciones: ['spr.svg'],
  cuadrosPorSegundo: 0,
  anchoEnPixeles: 100,
  altoEnPixeles: 170,
  anchoEnMetros: 1,
  altoEnMetros: 1.7,
};

const CAMARA_DEL_NIVEL = { distanciaEnMetros: 8, alturaEnMetros: 4, giroEnGrados: 0 };
const AJUSTES_DEL_PUESTO = { distanciaEnMetros: 4, alturaEnMetros: 2, giroEnGrados: 20 };
const AJUSTES_DE_TORTU = { distanciaEnMetros: 3, alturaEnMetros: 2, giroEnGrados: 0 };

const CONTENIDO: Contenido = {
  meta: {
    id: 'barrio',
    titulo: 'El barrio',
    personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' }, tortu: { idioma: 'es', sprite: 'spr_tortu' } },
  },
  jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2 },
  mundo: {
    pixelesPorMetro: 100,
    camara: CAMARA_DEL_NIVEL,
    colorDeFondo: '#bfe6f5',
    sonidos: {},
    planos: {
      plano_puesto: { mira: 'puesto', ...AJUSTES_DEL_PUESTO },
      plano_tortu: { mira: 'tortu', ...AJUSTES_DE_TORTU },
    },
  },
  estado: { objetivos: [], variables: [], lista: {} },
  secuencias: {},
  npcs: {},
  interactivos: {},
  cinematicas: {},
  comentarios: {},
};

const SIN_CORTAR = new AbortController().signal;

/** Tommy (el jugador) en (2, 3), Doña Tortu en (6, 2) y el punto "puesto" en (8, 1). */
async function crearCamara(opciones: { conJugador: boolean; conMenosMovimiento: boolean }) {
  const escenario = new EscenarioDeMemoria();
  const reparto = new Reparto(escenario);
  await reparto.agregar({ id: 'tommy', imagen: IMAGEN, posicion: { x: 2, y: 3 }, mira: 'derecha', sePuedeTocar: false });
  await reparto.agregar({ id: 'tortu', imagen: IMAGEN, posicion: { x: 6, y: 2 }, mira: 'izquierda', sePuedeTocar: true });

  let contenido = CONTENIDO;
  if (!opciones.conJugador) {
    contenido = { ...CONTENIDO, jugador: undefined };
  }
  const camara = new CamaraDeEscena({
    escenario,
    reparto,
    contenido,
    puntos: { puesto: { x: 8, y: 1 } },
    decorado: [],
    centroDelLugar: { x: 5, y: 2 },
    conMenosMovimiento: opciones.conMenosMovimiento,
  });
  return { camara, escenario, reparto };
}

test('al empezar, la cámara ya está sobre el jugador con los ajustes del nivel', async () => {
  const { escenario } = await crearCamara({ conJugador: true, conMenosMovimiento: false });

  expect(escenario.puntoEnfocado).toEqual({ x: 2, y: 3 });
  expect(escenario.camaraEnfocada).toEqual(CAMARA_DEL_NIVEL);
});

test('en un nivel sin jugador, la cámara empieza mirando al centro del lugar', async () => {
  const { escenario } = await crearCamara({ conJugador: false, conMenosMovimiento: false });

  expect(escenario.puntoEnfocado).toEqual({ x: 5, y: 2 });
});

test('cuando el jugador camina, la cámara lo sigue con suavidad: se acerca sin saltar', async () => {
  const { camara, escenario, reparto } = await crearCamara({ conJugador: true, conMenosMovimiento: false });

  reparto.mover('tommy', { x: 4, y: 3 });
  camara.actualizar(0.1);

  expect(escenario.puntoEnfocado?.x).toBeGreaterThan(2);
  expect(escenario.puntoEnfocado?.x).toBeLessThan(4);
  camara.actualizar(60);
  expect(escenario.puntoEnfocado?.x).toBeCloseTo(4);
});

test('un corte a un plano pone la cámara de inmediato sobre lo que el plano mira, con sus ajustes', async () => {
  const { camara, escenario } = await crearCamara({ conJugador: true, conMenosMovimiento: false });

  camara.cortarA('plano_puesto');

  expect(escenario.puntoEnfocado).toEqual({ x: 8, y: 1 });
  expect(escenario.camaraEnfocada).toEqual(AJUSTES_DEL_PUESTO);
});

test('un corte a un personaje lo sigue con la cámara del nivel', async () => {
  const { camara, escenario, reparto } = await crearCamara({ conJugador: true, conMenosMovimiento: false });

  camara.cortarA('tortu');
  expect(escenario.puntoEnfocado).toEqual({ x: 6, y: 2 });
  expect(escenario.camaraEnfocada).toEqual(CAMARA_DEL_NIVEL);

  reparto.mover('tortu', { x: 7, y: 2 });
  camara.actualizar(60);
  expect(escenario.puntoEnfocado?.x).toBeCloseTo(7);
});

test('un plano que mira a un personaje lo sigue cuando camina', async () => {
  const { camara, escenario, reparto } = await crearCamara({ conJugador: true, conMenosMovimiento: false });

  camara.cortarA('plano_tortu');
  reparto.mover('tortu', { x: 9, y: 2 });
  camara.actualizar(60);

  expect(escenario.puntoEnfocado?.x).toBeCloseTo(9);
  expect(escenario.camaraEnfocada).toEqual(AJUSTES_DE_TORTU);
});

test('un viaje lleva la cámara poco a poco y termina cuando llega', async () => {
  const { camara, escenario } = await crearCamara({ conJugador: true, conMenosMovimiento: false });
  let llego = false;

  void camara.viajarA('plano_puesto', 2, SIN_CORTAR).then(() => {
    llego = true;
  });
  camara.actualizar(1);
  await Promise.resolve();

  // A medio viaje, la cámara está a la mitad entre el jugador (2, 3) y el puesto (8, 1).
  expect(escenario.puntoEnfocado).toEqual({ x: 5, y: 2 });
  expect(escenario.camaraEnfocada?.distanciaEnMetros).toBe(6);
  expect(llego).toBe(false);

  camara.actualizar(1);
  await Promise.resolve();
  expect(escenario.puntoEnfocado).toEqual({ x: 8, y: 1 });
  expect(escenario.camaraEnfocada).toEqual(AJUSTES_DEL_PUESTO);
  expect(llego).toBe(true);
});

test('si se deja de esperar un viaje, la promesa termina y la cámara acaba su viaje sola', async () => {
  const { camara, escenario } = await crearCamara({ conJugador: true, conMenosMovimiento: false });
  const cancelador = new AbortController();
  let termino = false;

  void camara.viajarA('plano_puesto', 2, cancelador.signal).then(() => {
    termino = true;
  });
  camara.actualizar(1);
  cancelador.abort();
  await Promise.resolve();
  expect(termino).toBe(true);

  camara.actualizar(1);
  expect(escenario.puntoEnfocado).toEqual({ x: 8, y: 1 });
});

test('con movimiento reducido, un viaje se vuelve un corte', async () => {
  const { camara, escenario } = await crearCamara({ conJugador: true, conMenosMovimiento: true });

  await camara.viajarA('plano_puesto', 2, SIN_CORTAR);

  expect(escenario.puntoEnfocado).toEqual({ x: 8, y: 1 });
});

test('volver al jugador regresa la cámara a él si una escena la dejó en otro lado', async () => {
  const { camara, escenario } = await crearCamara({ conJugador: true, conMenosMovimiento: false });
  camara.cortarA('plano_puesto');
  expect(camara.apuntaAlJugador).toBe(false);

  camara.volverAlJugador();
  camara.actualizar(60);

  expect(camara.apuntaAlJugador).toBe(true);
  expect(escenario.puntoEnfocado).toEqual({ x: 2, y: 3 });
  expect(escenario.camaraEnfocada).toEqual(CAMARA_DEL_NIVEL);
});

test('si se apunta a un personaje que no está en el escenario, la cámara se queda donde miraba', async () => {
  const { camara, escenario, reparto } = await crearCamara({ conJugador: true, conMenosMovimiento: false });
  reparto.quitar('tortu');

  camara.cortarA('tortu');

  expect(escenario.puntoEnfocado).toEqual({ x: 2, y: 3 });
});
