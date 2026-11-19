import { expect, test } from 'bun:test';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import type { Contenido } from '../dominio/contenido.ts';
import type { ImagenDeEscena } from '../puertos/escenario.ts';
import { buscarLugarMasCercano, reunirLugaresConNombre } from './lugares-con-nombre.ts';
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
    personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' }, mama: { idioma: 'es', sprite: 'spr_mama' } },
  },
  mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
  estado: { objetivos: [], variables: [], lista: {} },
  secuencias: {},
  npcs: {},
  interactivos: {},
  cinematicas: {},
  comentarios: {},
};

/** Tommy está en el escenario, en (2, 3). Mamá existe en el contenido, pero todavía no entra. */
async function reunir() {
  const reparto = new Reparto(new EscenarioDeMemoria());
  await reparto.agregar({ id: 'tommy', imagen: IMAGEN, posicion: { x: 2, y: 3 }, mira: 'derecha', sePuedeTocar: false });
  return reunirLugaresConNombre({
    contenido: CONTENIDO,
    reparto,
    puntos: { puerta: { x: 9, y: 2 } },
    decorado: [
      { descripcion: 'comal', clase: 'parado', asset: 'comal', huella: { x: 6, y: 2, ancho: 1, alto: 1 }, alturaEnMetros: 0, id: 'comal' },
      { descripcion: 'cajas', clase: 'parado', asset: 'cajas', huella: { x: 0, y: 0, ancho: 1, alto: 1 }, alturaEnMetros: 0 },
    ],
  });
}

test('tienen nombre los personajes que están en el escenario, los puntos y los objetos con id', async () => {
  const lugares = await reunir();

  // Mamá no está en el escenario y las cajas no tienen id: ninguno de los dos aparece.
  expect(lugares).toEqual([
    { nombre: 'tommy', punto: { x: 2, y: 3 } },
    { nombre: 'puerta', punto: { x: 9, y: 2 } },
    { nombre: 'comal', punto: { x: 6.5, y: 2.5 } },
  ]);
});

test('el lugar más cercano es el que está a menor distancia, si cae dentro del radio', async () => {
  const lugares = await reunir();

  expect(buscarLugarMasCercano(lugares, { x: 8.5, y: 2 }, 1)?.nombre).toBe('puerta');
  expect(buscarLugarMasCercano(lugares, { x: 4, y: 0 }, 1)).toBeUndefined();
});
