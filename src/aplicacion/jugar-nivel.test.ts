import { expect, test } from 'bun:test';
import { CargadorDeMemoria } from '../adaptadores/memoria/cargador-de-memoria.ts';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import type { Nivel } from '../dominio/nivel.ts';
import { jugarNivel } from './jugar-nivel.ts';

/** Un barrio pequeño: Tommy (el jugador) empieza en (2, 3) y Doña Tortu lo espera en (6, 2). */
const NIVEL: Nivel = {
  descripcion: { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.'] },
  contenido: {
    meta: {
      id: 'barrio',
      titulo: 'El barrio',
      personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' }, tortu: { idioma: 'es', sprite: 'spr_tortu' } },
    },
    jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2 },
    mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
    estado: { objetivos: [], variables: [], lista: {} },
    secuencias: {},
    npcs: { tortu: { dialogo: [] } },
    interactivos: {},
    comentarios: {},
  },
  mundo: {
    anchoEnMetros: 10,
    profundidadEnMetros: 4,
    suelo: { asset: 'suelo', esquina: { x: 0, y: 0 } },
    telones: [{ descripcion: 'telón', asset: 'suelo', desde: { x: 0, y: 0 }, hasta: { x: 10, y: 0 }, altoEnMetros: 4 }],
    decorado: [
      { descripcion: 'caja', clase: 'parado', asset: 'spr_tortu', huella: { x: 4.5, y: 1.5, ancho: 1, alto: 1 }, alturaEnMetros: 0 },
    ],
    npcs: { tortu: { descripcion: 'tortu', posicion: { x: 6, y: 2 }, mira: 'izquierda' } },
    iniciosDelJugador: [{ descripcion: 'inicio', posicion: { x: 2, y: 3 }, mira: 'derecha' }],
    puntos: {},
    zonas: {},
    pisos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }]],
  },
  assets: {
    suelo: { carpeta: '.', asset: { tipo: 'imagen', archivo: 'img/suelo.svg', anchoEnPixeles: 1000, altoEnPixeles: 400 } },
    spr_tommy: { carpeta: '../comun', asset: { tipo: 'imagen', archivo: 'img/spr_tommy.svg', anchoEnPixeles: 90, altoEnPixeles: 160 } },
    spr_tortu: { carpeta: '.', asset: { tipo: 'imagen', archivo: 'img/spr_tortu.svg', anchoEnPixeles: 110, altoEnPixeles: 170 } },
  },
};

const UBICACION = { direccionDelNivel: '/niveles/barrio/nivel.json', cargador: new CargadorDeMemoria({}) };

test('al empezar, monta la escenografía con la dirección y el tamaño en metros de cada imagen', async () => {
  const escenario = new EscenarioDeMemoria();

  await jugarNivel(NIVEL, UBICACION, { escenario, reloj: new RelojDeMemoria() });

  expect(escenario.escenografia?.suelo).toEqual({
    esquina: { x: 0, y: 0 },
    imagen: {
      direcciones: ['/niveles/barrio/img/suelo.svg'],
      cuadrosPorSegundo: 0,
      anchoEnPixeles: 1000,
      altoEnPixeles: 400,
      anchoEnMetros: 10,
      altoEnMetros: 4,
    },
  });
  expect(escenario.escenografia?.telones).toHaveLength(1);
  expect(escenario.escenografia?.decorado[0]?.huella).toEqual({ x: 4.5, y: 1.5, ancho: 1, alto: 1 });
});

test('pone en el escenario a los NPCs del mapa y al jugador en su inicio', async () => {
  const escenario = new EscenarioDeMemoria();

  await jugarNivel(NIVEL, UBICACION, { escenario, reloj: new RelojDeMemoria() });

  expect(escenario.personajes.get('tortu')).toEqual({ posicion: { x: 6, y: 2 }, mira: 'izquierda', sePuedeTocar: true });
  expect(escenario.personajes.get('tommy')).toEqual({ posicion: { x: 2, y: 3 }, mira: 'derecha', sePuedeTocar: false });
});

test('tocar el piso hace caminar al jugador hacia ahí, cuadro tras cuadro', async () => {
  const escenario = new EscenarioDeMemoria();
  const reloj = new RelojDeMemoria();
  await jugarNivel(NIVEL, UBICACION, { escenario, reloj });

  escenario.simularToque({ tipo: 'piso', punto: { x: 4, y: 3 } });
  await reloj.avanzar(0.5);

  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 3, y: 3 });
  await reloj.avanzar(0.5);
  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 4, y: 3 });
});

test('cada cuadro se dibuja, aunque nadie se mueva', async () => {
  const escenario = new EscenarioDeMemoria();
  const reloj = new RelojDeMemoria();
  await jugarNivel(NIVEL, UBICACION, { escenario, reloj });

  await reloj.avanzar(0.016);
  await reloj.avanzar(0.016);

  expect(escenario.cuadrosDibujados).toBe(2);
});

test('al terminar, deja de atender toques y de dibujar', async () => {
  const escenario = new EscenarioDeMemoria();
  const reloj = new RelojDeMemoria();
  const nivelEnJuego = await jugarNivel(NIVEL, UBICACION, { escenario, reloj });

  nivelEnJuego.terminar();
  escenario.simularToque({ tipo: 'piso', punto: { x: 4, y: 3 } });
  await reloj.avanzar(0.5);

  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 2, y: 3 });
  expect(escenario.cuadrosDibujados).toBe(0);
});

test('en un nivel sin jugador, la cámara mira al centro del lugar', async () => {
  const escenario = new EscenarioDeMemoria();
  const nivelSinJugador: Nivel = {
    ...NIVEL,
    contenido: { ...NIVEL.contenido, jugador: undefined },
    mundo: { ...NIVEL.mundo, iniciosDelJugador: [] },
  };

  await jugarNivel(nivelSinJugador, UBICACION, { escenario, reloj: new RelojDeMemoria() });

  expect(escenario.puntoEnfocado).toEqual({ x: 5, y: 2 });
  expect(escenario.personajes.has('tommy')).toBe(false);
});
