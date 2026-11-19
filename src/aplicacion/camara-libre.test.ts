import { expect, test } from 'bun:test';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { PanelDeDepuracionDeMemoria } from '../adaptadores/memoria/panel-de-depuracion-de-memoria.ts';
import type { Contenido } from '../dominio/contenido.ts';
import type { ImagenDeEscena } from '../puertos/escenario.ts';
import { CamaraLibre } from './camara-libre.ts';
import { Reparto } from './reparto.ts';

const IMAGEN: ImagenDeEscena = {
  direcciones: ['spr.svg'],
  cuadrosPorSegundo: 0,
  anchoEnPixeles: 100,
  altoEnPixeles: 170,
  anchoEnMetros: 1,
  altoEnMetros: 1.7,
};

const CONTENIDO: Contenido = {
  meta: {
    id: 'barrio',
    titulo: 'El barrio',
    personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' }, tortu: { idioma: 'es', sprite: 'spr_tortu' } },
  },
  jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2 },
  mundo: {
    pixelesPorMetro: 100,
    camara: { distanciaEnMetros: 8, alturaEnMetros: 4, giroEnGrados: 0 },
    sonidos: {},
    planos: { plano_puesto: { mira: 'puesto', distanciaEnMetros: 5, alturaEnMetros: 2.5, giroEnGrados: 20 } },
  },
  estado: { objetivos: [], variables: [], lista: {} },
  secuencias: {},
  npcs: {},
  interactivos: {},
  cinematicas: {},
  comentarios: {},
};

/** Tommy (el jugador) en (2, 3), Doña Tortu en (6, 2) y el punto "puesto" en (8, 1). */
async function crearCamaraLibre() {
  const escenario = new EscenarioDeMemoria();
  const panel = new PanelDeDepuracionDeMemoria();
  const reparto = new Reparto(escenario);
  await reparto.agregar({ id: 'tommy', imagen: IMAGEN, posicion: { x: 2, y: 3 }, mira: 'derecha', sePuedeTocar: false });
  await reparto.agregar({ id: 'tortu', imagen: IMAGEN, posicion: { x: 6, y: 2 }, mira: 'izquierda', sePuedeTocar: true });
  /** `'pausa'` y `'reanuda'`, en el orden en que la cámara libre los pidió. */
  const pausas: string[] = [];

  const camaraLibre = new CamaraLibre({
    contenido: CONTENIDO,
    puntos: { puesto: { x: 8, y: 1 } },
    decorado: [],
    centroDelLugar: { x: 5, y: 2 },
    escenario,
    reparto,
    panel,
    pausarElJuego: () => pausas.push('pausa'),
    reanudarElJuego: () => pausas.push('reanuda'),
  });
  return { camaraLibre, escenario, panel, pausas };
}

test('al entrar a la cámara libre el juego se pausa, y al salir se reanuda', async () => {
  const { camaraLibre, panel, pausas } = await crearCamaraLibre();
  expect(camaraLibre.estaActiva).toBe(false);

  panel.simularOrden({ tipo: 'alternarCamaraLibre' });
  expect(camaraLibre.estaActiva).toBe(true);
  expect(panel.laCamaraLibreEstaActiva).toBe(true);
  expect(pausas).toEqual(['pausa']);

  panel.simularOrden({ tipo: 'alternarCamaraLibre' });
  expect(camaraLibre.estaActiva).toBe(false);
  expect(panel.laCamaraLibreEstaActiva).toBe(false);
  expect(pausas).toEqual(['pausa', 'reanuda']);
});

test('al entrar, el plano mira al jugador con la cámara del nivel y se dibuja aunque el juego esté en pausa', async () => {
  const { escenario, panel } = await crearCamaraLibre();

  panel.simularOrden({ tipo: 'alternarCamaraLibre' });

  expect(escenario.puntoEnfocado).toEqual({ x: 2, y: 3 });
  expect(escenario.camaraEnfocada).toEqual({ distanciaEnMetros: 8, alturaEnMetros: 4, giroEnGrados: 0 });
  expect(escenario.cuadrosDibujados).toBe(1);
  expect(panel.texto).toContain('"plano_nuevo": { "mira": "tommy", "distancia": 8, "altura": 4, "giro": 0 }');
});

test('arrastrar gira la cámara y la sube, y la rueda la aleja', async () => {
  const { escenario, panel } = await crearCamaraLibre();
  panel.simularOrden({ tipo: 'alternarCamaraLibre' });

  panel.simularOrden({ tipo: 'girar', haciaLaDerechaEnPuntos: 100, haciaAbajoEnPuntos: 50 });
  expect(escenario.camaraEnfocada).toEqual({ distanciaEnMetros: 8, alturaEnMetros: 5, giroEnGrados: -30 });

  panel.simularOrden({ tipo: 'alejar', muescas: 1 });
  expect(escenario.camaraEnfocada?.distanciaEnMetros).toBeCloseTo(8.8);
});

test('la cámara no baja del piso ni se acerca hasta atravesar lo que mira', async () => {
  const { escenario, panel } = await crearCamaraLibre();
  panel.simularOrden({ tipo: 'alternarCamaraLibre' });

  panel.simularOrden({ tipo: 'girar', haciaLaDerechaEnPuntos: 0, haciaAbajoEnPuntos: -10_000 });
  panel.simularOrden({ tipo: 'alejar', muescas: -100 });

  expect(escenario.camaraEnfocada?.alturaEnMetros).toBe(0.2);
  expect(escenario.camaraEnfocada?.distanciaEnMetros).toBe(1);
});

test('tocar a un personaje lo fija como lo que mira el plano', async () => {
  const { camaraLibre, escenario, panel } = await crearCamaraLibre();
  panel.simularOrden({ tipo: 'alternarCamaraLibre' });

  camaraLibre.atenderToque({ tipo: 'personaje', id: 'tortu' });

  expect(escenario.puntoEnfocado).toEqual({ x: 6, y: 2 });
  expect(panel.texto).toContain('"mira": "tortu"');
});

test('tocar el piso cerca de un punto del mapa lo fija; lejos de todo, avisa y no cambia nada', async () => {
  const { camaraLibre, escenario, panel } = await crearCamaraLibre();
  panel.simularOrden({ tipo: 'alternarCamaraLibre' });

  camaraLibre.atenderToque({ tipo: 'piso', punto: { x: 8.3, y: 1.2 } });
  expect(escenario.puntoEnfocado).toEqual({ x: 8, y: 1 });
  expect(panel.texto).toContain('"mira": "puesto"');

  camaraLibre.atenderToque({ tipo: 'piso', punto: { x: 0, y: 0 } });
  expect(panel.texto).toContain('"mira": "puesto"');
  expect(panel.texto).toContain('Ahí no hay nada con nombre');
});

test('las teclas de número saltan a los planos que el nivel ya tiene', async () => {
  const { escenario, panel } = await crearCamaraLibre();
  panel.simularOrden({ tipo: 'alternarCamaraLibre' });

  panel.simularOrden({ tipo: 'irAlPlano', numero: 1 });
  expect(escenario.puntoEnfocado).toEqual({ x: 8, y: 1 });
  expect(escenario.camaraEnfocada).toEqual({ distanciaEnMetros: 5, alturaEnMetros: 2.5, giroEnGrados: 20 });

  panel.simularOrden({ tipo: 'irAlPlano', numero: 2 });
  expect(panel.texto).toContain('El nivel no tiene un plano número 2.');
});

test('copiar deja en el portapapeles el plano listo para pegar en mundo.planos', async () => {
  const { camaraLibre, panel } = await crearCamaraLibre();
  panel.simularOrden({ tipo: 'alternarCamaraLibre' });
  camaraLibre.atenderToque({ tipo: 'personaje', id: 'tortu' });
  panel.simularOrden({ tipo: 'girar', haciaLaDerechaEnPuntos: -50, haciaAbajoEnPuntos: -75 });

  panel.simularOrden({ tipo: 'copiarPlano' });
  await Promise.resolve();

  expect(panel.textosCopiados).toEqual(['"plano_nuevo": { "mira": "tortu", "distancia": 8, "altura": 2.5, "giro": 15 }']);
  expect(panel.texto).toContain('Copiado.');
});

test('fuera de la cámara libre, las órdenes y los toques no hacen nada', async () => {
  const { camaraLibre, escenario, panel } = await crearCamaraLibre();

  panel.simularOrden({ tipo: 'girar', haciaLaDerechaEnPuntos: 100, haciaAbajoEnPuntos: 0 });
  panel.simularOrden({ tipo: 'copiarPlano' });
  camaraLibre.atenderToque({ tipo: 'personaje', id: 'tortu' });

  expect(escenario.cuadrosDibujados).toBe(0);
  expect(panel.textosCopiados).toEqual([]);
});

test('al destruirla estando activa, el juego se reanuda y deja de atender órdenes', async () => {
  const { camaraLibre, panel, pausas } = await crearCamaraLibre();
  panel.simularOrden({ tipo: 'alternarCamaraLibre' });

  camaraLibre.destruir();
  panel.simularOrden({ tipo: 'alternarCamaraLibre' });

  expect(pausas).toEqual(['pausa', 'reanuda']);
  expect(camaraLibre.estaActiva).toBe(false);
});
