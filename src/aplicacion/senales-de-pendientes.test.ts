import { expect, test } from 'bun:test';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { InterfazDeMemoria } from '../adaptadores/memoria/interfaz-de-memoria.ts';
import { leerCondicionDeTexto } from '../dominio/condicion.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import { crearEstadoDeNivel } from '../dominio/estado.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { ImagenDeEscena } from '../puertos/escenario.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';
import { Reparto } from './reparto.ts';
import { SenalesDePendientes } from './senales-de-pendientes.ts';

const IMAGEN: ImagenDeEscena = {
  direcciones: ['spr.svg'],
  cuadrosPorSegundo: 0,
  anchoEnPixeles: 90,
  altoEnPixeles: 160,
  anchoEnMetros: 0.9,
  altoEnMetros: 1.6,
};

/**
 * Un mercado con doña Igu (vende verduras: su señal se ve mientras no se compren), don Tlacua (siempre tiene
 * señal), la abuela (sin señal) y la báscula, un interactivo con señal. En el escenario falso la «pantalla»
 * es el propio plano, así que el lugar de cada señal es dónde pisa.
 */
const MERCADO: Nivel = {
  descripcion: { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.'] },
  contenido: {
    meta: {
      id: 'mercado',
      titulo: 'El mercado',
      personajes: {
        igu: { idioma: 'es', sprite: 'spr' },
        tlacua: { idioma: 'es', sprite: 'spr' },
        abuela: { idioma: 'es', sprite: 'spr' },
      },
    },
    mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
    estado: { objetivos: ['verduras'], variables: [], lista: {} },
    secuencias: {},
    npcs: {
      igu: { dialogo: [], senal: { visibleCuando: leerCondicionDeTexto('no tengo verduras') } },
      tlacua: { dialogo: [], senal: {} },
      abuela: { dialogo: [] },
    },
    interactivos: { bascula: { dialogo: [], senal: {} } },
    cinematicas: {},
    comentarios: {},
  },
  mundo: {
    anchoEnMetros: 10,
    profundidadEnMetros: 6,
    telones: [],
    decorado: [
      { descripcion: 'báscula', clase: 'plano', asset: 'spr', huella: { x: 7, y: 4, ancho: 2, alto: 2 }, alturaEnMetros: 0, id: 'bascula' },
    ],
    npcs: {},
    iniciosDelJugador: [],
    puntos: {},
    zonas: {},
    pisos: [],
  },
  assets: { spr: { carpeta: '.', asset: { tipo: 'imagen', archivo: 'spr.svg', anchoEnPixeles: 90, altoEnPixeles: 160 } } },
};

async function crearSenales() {
  const escenario = new EscenarioDeMemoria();
  const interfaz = new InterfazDeMemoria();
  const reparto = new Reparto(escenario);
  await reparto.agregar({ id: 'igu', imagen: IMAGEN, posicion: { x: 2, y: 2 }, mira: 'derecha', sePuedeTocar: true });
  await reparto.agregar({ id: 'tlacua', imagen: IMAGEN, posicion: { x: 4, y: 2 }, mira: 'derecha', sePuedeTocar: true });
  await reparto.agregar({ id: 'abuela', imagen: IMAGEN, posicion: { x: 6, y: 2 }, mira: 'derecha', sePuedeTocar: true });
  const estado = new EstadoEnJuego(crearEstadoDeNivel(MERCADO.contenido.estado), () => {});
  const senales = new SenalesDePendientes({ nivel: MERCADO, estado, reparto, escenario, interfaz });
  return { senales, interfaz, estado };
}

test('hay una señal sobre cada NPC e interactivo con "senal" cuyo visibleCuando se cumple', async () => {
  const { senales, interfaz, estado } = await crearSenales();

  senales.actualizar(true, undefined);
  expect(interfaz.lugaresDeLasSenales).toEqual([{ x: 2, y: 2 }, { x: 4, y: 2 }, { x: 8, y: 5 }]);

  estado.aplicar({ verduras: true });
  senales.actualizar(true, undefined);
  expect(interfaz.lugaresDeLasSenales).toEqual([{ x: 4, y: 2 }, { x: 8, y: 5 }]);
});

test('durante una escena se quitan, y no se ven sobre lo que el jugador tiene a la mano', async () => {
  const { senales, interfaz } = await crearSenales();
  senales.actualizar(true, undefined);

  senales.actualizar(false, undefined);
  expect(interfaz.lugaresDeLasSenales).toEqual([]);

  senales.actualizar(true, { tipo: 'personaje', id: 'tlacua' });
  expect(interfaz.lugaresDeLasSenales).toEqual([{ x: 2, y: 2 }, { x: 8, y: 5 }]);
});
