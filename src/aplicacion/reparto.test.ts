import { expect, test } from 'bun:test';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import type { ImagenDeEscena, PersonajeDeEscena } from '../puertos/escenario.ts';
import { Reparto } from './reparto.ts';

const IMAGEN: ImagenDeEscena = {
  direcciones: ['spr_tortu.svg'],
  cuadrosPorSegundo: 0,
  anchoEnPixeles: 110,
  altoEnPixeles: 170,
  anchoEnMetros: 1.1,
  altoEnMetros: 1.7,
};

const TORTU: PersonajeDeEscena = { id: 'tortu', imagen: IMAGEN, posicion: { x: 5, y: 2 }, mira: 'izquierda', sePuedeTocar: true };

test('un personaje agregado queda en el escenario y se sabe dónde está', async () => {
  const escenario = new EscenarioDeMemoria();
  const reparto = new Reparto(escenario);

  await reparto.agregar(TORTU);

  expect(reparto.estaEnEscena('tortu')).toBe(true);
  expect(reparto.posicionDe('tortu')).toEqual({ x: 5, y: 2 });
  expect(escenario.personajes.get('tortu')?.posicion).toEqual({ x: 5, y: 2 });
});

test('mover un personaje cambia su posición aquí y en el escenario', async () => {
  const escenario = new EscenarioDeMemoria();
  const reparto = new Reparto(escenario);
  await reparto.agregar(TORTU);

  reparto.mover('tortu', { x: 6, y: 3 });

  expect(reparto.posicionDe('tortu')).toEqual({ x: 6, y: 3 });
  expect(escenario.personajes.get('tortu')?.posicion).toEqual({ x: 6, y: 3 });
});

test('mirar hacia un punto voltea al personaje solo si el punto está a su otro lado', async () => {
  const escenario = new EscenarioDeMemoria();
  const reparto = new Reparto(escenario);
  await reparto.agregar(TORTU);

  reparto.mirarHacia('tortu', { x: 1, y: 2 });
  expect(escenario.personajes.get('tortu')?.mira).toBe('izquierda');

  reparto.mirarHacia('tortu', { x: 9, y: 2 });
  expect(escenario.personajes.get('tortu')?.mira).toBe('derecha');

  // Un punto justo enfrente no le dice hacia qué lado voltear: se queda como estaba.
  reparto.mirarHacia('tortu', { x: 5, y: 4 });
  expect(escenario.personajes.get('tortu')?.mira).toBe('derecha');
});

test('quien no está en el escenario no tiene posición, y moverlo no hace nada', () => {
  const reparto = new Reparto(new EscenarioDeMemoria());

  reparto.mover('mama', { x: 1, y: 1 });

  expect(reparto.estaEnEscena('mama')).toBe(false);
  expect(reparto.posicionDe('mama')).toBeUndefined();
});
