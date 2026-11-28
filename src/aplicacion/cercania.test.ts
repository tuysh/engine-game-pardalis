// Comprueba qué cuenta como «a la mano»: un objeto del decorado escondido por su `visibleCuando`
// o uno que lleva id sin diálogo (solo para un paso `anima` o un plano) no se puede usar.

import { expect, test } from 'bun:test';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { InterfazDeMemoria } from '../adaptadores/memoria/interfaz-de-memoria.ts';
import { leerCondicionDeTexto } from '../dominio/condicion.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import { crearEstadoDeNivel } from '../dominio/estado.ts';
import type { Nivel } from '../dominio/nivel.ts';
import { Cercania } from './cercania.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';
import { Reparto } from './reparto.ts';

/**
 * Un puesto de 6 × 4 metros con dos objetos junto al jugador: el letrero de las verduras, que tiene diálogo
 * y se quita al comprarlas, y la mesa de la familia, que lleva id solo para que la anime un paso `anima`.
 */
const PUESTO: Nivel = {
  descripcion: { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.'] },
  contenido: {
    meta: { id: 'mercado', titulo: 'El mercado', personajes: { pardi: { idioma: 'es', sprite: 'spr_pardi' } } },
    jugador: { personaje: 'pardi', velocidadEnMetrosPorSegundo: 2 },
    mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
    estado: { objetivos: ['verduras'], variables: [], lista: {} },
    secuencias: {},
    npcs: {},
    interactivos: { letrero: { dialogo: [{ pasos: [] }] } },
    cinematicas: {},
    comentarios: {},
  },
  mundo: {
    anchoEnMetros: 6,
    profundidadEnMetros: 4,
    telones: [],
    decorado: [
      {
        descripcion: 'objeto #1 "Letrero"',
        clase: 'plano',
        asset: 'letrero',
        huella: { x: 2, y: 2, ancho: 0.5, alto: 0.5 },
        alturaEnMetros: 0,
        id: 'letrero',
        visibleCuando: leerCondicionDeTexto('no tengo verduras'),
      },
      {
        descripcion: 'objeto #2 "Mesa"',
        clase: 'plano',
        asset: 'letrero',
        huella: { x: 3, y: 2, ancho: 0.5, alto: 0.5 },
        alturaEnMetros: 0,
        id: 'mesa_familia',
      },
    ],
    npcs: {},
    iniciosDelJugador: [{ descripcion: 'inicio', posicion: { x: 2.5, y: 2.5 }, mira: 'derecha' }],
    puntos: {},
    zonas: {},
    pisos: [[{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }]],
  },
  assets: {
    letrero: { carpeta: '.', asset: { tipo: 'imagen', archivo: 'img/letrero.svg', anchoEnPixeles: 50, altoEnPixeles: 50 } },
  },
};

function crearCercania() {
  const escenario = new EscenarioDeMemoria();
  const estado = new EstadoEnJuego(crearEstadoDeNivel(PUESTO.contenido.estado), () => {});
  const cercania = new Cercania({
    nivel: PUESTO,
    reparto: new Reparto(escenario),
    escenario,
    interfaz: new InterfazDeMemoria(),
    estado,
  });
  return { cercania, estado };
}

test('el letrero con diálogo está a la mano mientras se ve; escondido por su visibleCuando, ya no', () => {
  const { cercania, estado } = crearCercania();

  expect(cercania.buscar({ x: 2.5, y: 2.5 })?.id).toBe('letrero');

  estado.aplicar({ verduras: true });
  // La mesa está igual de cerca, pero sin diálogo no se puede usar.
  expect(cercania.buscar({ x: 2.5, y: 2.5 })).toBeUndefined();
});
