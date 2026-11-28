import { expect, test } from 'bun:test';
import { crearMapaDeCaminos } from '../dominio/rejilla-de-caminos.ts';
import { AudioDeMemoria } from '../adaptadores/memoria/audio-de-memoria.ts';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { InterfazDeMemoria } from '../adaptadores/memoria/interfaz-de-memoria.ts';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import { crearEstadoDeNivel } from '../dominio/estado.ts';
import type { ImagenDeEscena } from '../puertos/escenario.ts';
import { caminarEnEscena } from './caminar-en-escena.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';
import { Reparto } from './reparto.ts';

const IMAGEN: ImagenDeEscena = {
  direcciones: ['spr.svg'],
  cuadrosPorSegundo: 0,
  anchoEnPixeles: 100,
  altoEnPixeles: 170,
  anchoEnMetros: 1,
  altoEnMetros: 1.7,
};

/** Una escena con Doña Tortu en (5, 2), mirando a la izquierda, y el punto "frente" en (9, 2). */
async function crearEscena() {
  const escenario = new EscenarioDeMemoria();
  const reloj = new RelojDeMemoria();
  const reparto = new Reparto(escenario);
  await reparto.agregar({ id: 'tortu', imagen: IMAGEN, posicion: { x: 5, y: 2 }, mira: 'izquierda', sePuedeTocar: true });

  const piezas: PiezasDeEscena = {
    contenido: {
      meta: { id: 'barrio', titulo: 'El barrio', personajes: { tortu: { idioma: 'es', sprite: 'spr_tortu' } } },
      jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2 },
      mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
      estado: { objetivos: [], variables: [], lista: {} },
      secuencias: {},
      npcs: {},
      interactivos: {},
      cinematicas: {},
      comentarios: {},
    },
    caminos: crearMapaDeCaminos({ pisos: [], obstaculos: [] }),
    puntos: { frente: { x: 9, y: 2 } },
    centroDelLugar: { x: 5, y: 2 },
    idiomaBase: 'es',
    escenario,
    interfaz: new InterfazDeMemoria(),
    audio: new AudioDeMemoria(),
    reloj,
    reparto,
    estado: new EstadoEnJuego(crearEstadoDeNivel({ objetivos: [], variables: [], lista: {} }), () => {}),
    minijuegos: {},
    direccionDeAsset: () => undefined,
    cuadrosDeAsset: () => undefined,
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
  return { piezas, escenario, reloj, reparto };
}

const SIN_INTERRUMPIR = new AbortController().signal;

test('el personaje avanza cuadro a cuadro hacia el punto, a la velocidad del jugador', async () => {
  const { piezas, reloj, reparto } = await crearEscena();

  void caminarEnEscena({ personaje: 'tortu', punto: 'frente' }, SIN_INTERRUMPIR, piezas);
  await reloj.avanzar(0.5);

  expect(reparto.posicionDe('tortu')).toEqual({ x: 6, y: 2 });
});

test('termina cuando el personaje llega justo al punto', async () => {
  const { piezas, reloj, reparto } = await crearEscena();
  let termino = false;

  void caminarEnEscena({ personaje: 'tortu', punto: 'frente' }, SIN_INTERRUMPIR, piezas).then(() => {
    termino = true;
  });
  await reloj.avanzar(1.9);
  expect(termino).toBe(false);
  await reloj.avanzar(0.5);

  expect(termino).toBe(true);
  expect(reparto.posicionDe('tortu')).toEqual({ x: 9, y: 2 });
});

test('voltea hacia donde camina', async () => {
  const { piezas, escenario, reloj } = await crearEscena();

  void caminarEnEscena({ personaje: 'tortu', punto: 'frente' }, SIN_INTERRUMPIR, piezas);
  await reloj.avanzar(0.1);

  expect(escenario.personajes.get('tortu')?.mira).toBe('derecha');
});

test('al interrumpir, el personaje se queda donde iba y deja de avanzar', async () => {
  const { piezas, reloj, reparto } = await crearEscena();
  const interrupcion = new AbortController();

  const caminata = caminarEnEscena({ personaje: 'tortu', punto: 'frente' }, interrupcion.signal, piezas);
  await reloj.avanzar(0.5);
  interrupcion.abort();
  await caminata;
  await reloj.avanzar(1);

  expect(reparto.posicionDe('tortu')).toEqual({ x: 6, y: 2 });
});

test('si quien camina no está en el escenario, termina de inmediato', async () => {
  const { piezas } = await crearEscena();

  await caminarEnEscena({ personaje: 'mama', punto: 'frente' }, SIN_INTERRUMPIR, piezas);

  expect(piezas.reparto.estaEnEscena('mama')).toBe(false);
});

test('si quien camina y su punto están sobre el piso, rodea el decorado en vez de atravesarlo', async () => {
  const { piezas, reloj, reparto } = await crearEscena();
  // Una calle de 10 × 4 con un puesto entre Doña Tortu (5, 2)… movida a (1, 1), y el punto "frente" (9, 2).
  const calleConPuesto = {
    pisos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }]],
    obstaculos: [{ x: 4, y: 0, ancho: 2, alto: 3 }],
  };
  reparto.mover('tortu', { x: 1, y: 1 });
  const piezasConPiso = { ...piezas, caminos: crearMapaDeCaminos(calleConPuesto) };
  let atravesoElPuesto = false;

  const caminata = caminarEnEscena({ personaje: 'tortu', punto: 'frente' }, SIN_INTERRUMPIR, piezasConPiso);
  for (let cuadro = 0; cuadro < 400; cuadro++) {
    await reloj.avanzar(0.02);
    const posicion = reparto.posicionDe('tortu') ?? { x: 0, y: 0 };
    if (posicion.x > 4 && posicion.x < 6 && posicion.y < 3) {
      atravesoElPuesto = true;
    }
  }
  await caminata;

  expect(reparto.posicionDe('tortu')).toEqual({ x: 9, y: 2 });
  expect(atravesoElPuesto).toBe(false);
});
