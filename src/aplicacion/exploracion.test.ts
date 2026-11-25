import { expect, test } from 'bun:test';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { crearMapaDeCaminos } from '../dominio/rejilla-de-caminos.ts';
import type { Terreno } from '../dominio/terreno.ts';
import type { ImagenDeEscena } from '../puertos/escenario.ts';
import { Exploracion } from './exploracion.ts';
import { Reparto } from './reparto.ts';

/** Una calle de 10 × 4 metros con una caja de 1 × 1 en medio. */
const TERRENO: Terreno = {
  pisos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }]],
  obstaculos: [{ x: 4.5, y: 1.5, ancho: 1, alto: 1 }],
};

const IMAGEN: ImagenDeEscena = {
  direcciones: ['spr_tommy.svg'],
  cuadrosPorSegundo: 0,
  anchoEnPixeles: 90,
  altoEnPixeles: 160,
  anchoEnMetros: 0.9,
  altoEnMetros: 1.6,
};

/** Un escenario falso con Tommy parado en (2, 3), y la exploración que lo controla a 2 metros por segundo. */
async function crearExploracion(): Promise<{ escenario: EscenarioDeMemoria; exploracion: Exploracion }> {
  const escenario = new EscenarioDeMemoria();
  const reparto = new Reparto(escenario);
  await reparto.agregar({ id: 'tommy', imagen: IMAGEN, posicion: { x: 2, y: 3 }, mira: 'derecha', sePuedeTocar: false });
  const exploracion = new Exploracion({
    reparto,
    caminos: crearMapaDeCaminos(TERRENO),
    idDelJugador: 'tommy',
    velocidadEnMetrosPorSegundo: 2,
  });
  return { escenario, exploracion };
}

test('sin destino, el jugador no se mueve', async () => {
  const { escenario, exploracion } = await crearExploracion();

  exploracion.avanzar(1);

  expect(exploracion.estaCaminando).toBe(false);
  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 2, y: 3 });
});

test('camina hacia donde se le manda, a su velocidad', async () => {
  const { escenario, exploracion } = await crearExploracion();

  exploracion.irA({ x: 8, y: 3 });
  exploracion.avanzar(0.5);

  expect(exploracion.estaCaminando).toBe(true);
  expect(exploracion.posicion).toEqual({ x: 3, y: 3 });
  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 3, y: 3 });
});

test('al llegar se detiene justo en el destino', async () => {
  const { exploracion } = await crearExploracion();

  exploracion.irA({ x: 3, y: 3 });
  exploracion.avanzar(2);

  expect(exploracion.estaCaminando).toBe(false);
  expect(exploracion.posicion).toEqual({ x: 3, y: 3 });
});

test('voltea hacia el lado al que camina', async () => {
  const { escenario, exploracion } = await crearExploracion();

  exploracion.irA({ x: 0.5, y: 3 });
  exploracion.avanzar(0.1);

  expect(escenario.personajes.get('tommy')?.mira).toBe('izquierda');
});

test('un destino fuera del piso se cambia por la orilla más cercana', async () => {
  const { exploracion } = await crearExploracion();

  exploracion.irA({ x: 2, y: 9 });
  exploracion.avanzar(5);

  expect(exploracion.posicion.x).toBeCloseTo(2, 1);
  expect(exploracion.posicion.y).toBeLessThan(4);
  expect(exploracion.posicion.y).toBeGreaterThan(3.9);
});

test('si algo le tapa el paso, lo rodea y llega', async () => {
  const { exploracion } = await crearExploracion();
  let pasoPorLaCaja = false;

  exploracion.irA({ x: 2, y: 2 });
  exploracion.avanzar(1);
  exploracion.irA({ x: 8, y: 2 }); // la caja queda justo en medio
  for (let cuadro = 0; cuadro < 400; cuadro++) {
    exploracion.avanzar(0.02);
    const { x, y } = exploracion.posicion;
    if (x > 4.5 && x < 5.5 && y > 1.5 && y < 2.5) {
      pasoPorLaCaja = true;
    }
  }

  expect(exploracion.estaCaminando).toBe(false);
  expect(exploracion.posicion).toEqual({ x: 8, y: 2 });
  expect(pasoPorLaCaja).toBe(false);
});

test('si se le manda a un lugar tapado por un obstáculo, llega lo más cerca que puede y avisa', async () => {
  const { exploracion } = await crearExploracion();
  let avisos = 0;

  exploracion.irA({ x: 5, y: 2 }, () => avisos++); // el centro de la caja
  for (let cuadro = 0; cuadro < 400; cuadro++) {
    exploracion.avanzar(0.02);
  }

  expect(avisos).toBe(1);
  expect(exploracion.estaCaminando).toBe(false);
  // Quedó pegado a la caja, sin meterse en ella.
  expect(Math.abs(exploracion.posicion.x - 5)).toBeLessThan(1);
  expect(Math.abs(exploracion.posicion.y - 2)).toBeLessThan(1);
});

test('detener lo deja quieto donde está', async () => {
  const { exploracion } = await crearExploracion();

  exploracion.irA({ x: 8, y: 3 });
  exploracion.avanzar(0.5);
  exploracion.detener();
  exploracion.avanzar(0.5);

  expect(exploracion.posicion).toEqual({ x: 3, y: 3 });
});

test('al terminar de caminar avisa a quien lo pidió, una sola vez', async () => {
  const { exploracion } = await crearExploracion();
  let avisos = 0;

  exploracion.irA({ x: 3, y: 3 }, () => avisos++);
  exploracion.avanzar(0.25);
  expect(avisos).toBe(0);
  exploracion.avanzar(1);
  exploracion.avanzar(1);

  expect(avisos).toBe(1);
});

test('si se le manda a otro lugar antes de llegar, el aviso anterior ya no se da', async () => {
  const { exploracion } = await crearExploracion();
  let avisos = 0;

  exploracion.irA({ x: 8, y: 3 }, () => avisos++);
  exploracion.avanzar(0.25);
  exploracion.irA({ x: 2, y: 3 });
  exploracion.avanzar(5);

  expect(avisos).toBe(0);
});

test('con el teclado camina hacia el lado oprimido, y en diagonal no va más rápido', async () => {
  const { exploracion } = await crearExploracion();

  exploracion.avanzar(0.5, { x: 1, y: 0 });
  expect(exploracion.posicion).toEqual({ x: 3, y: 3 });

  exploracion.avanzar(0.5, { x: -1, y: -1 });
  // En medio segundo camina 1 metro: en diagonal, unos 0.707 m en cada eje.
  expect(exploracion.posicion.x).toBeCloseTo(3 - Math.SQRT1_2, 5);
  expect(exploracion.posicion.y).toBeCloseTo(3 - Math.SQRT1_2, 5);
});

test('con el teclado voltea hacia donde camina y no se sale del piso', async () => {
  const { escenario, exploracion } = await crearExploracion();

  for (let cuadro = 0; cuadro < 200; cuadro++) {
    exploracion.avanzar(0.02, { x: -1, y: 0 });
  }

  expect(escenario.personajes.get('tommy')?.mira).toBe('izquierda');
  expect(exploracion.posicion.x).toBeGreaterThanOrEqual(0);
  expect(exploracion.posicion.x).toBeLessThan(0.1);
});

test('oprimir una dirección después de tocar un lugar cancela esa caminata y su aviso', async () => {
  const { exploracion } = await crearExploracion();
  let avisos = 0;

  exploracion.irA({ x: 8, y: 3 }, () => avisos++);
  exploracion.avanzar(0.25);
  exploracion.avanzar(0.25, { x: 0, y: -1 });
  exploracion.avanzar(5);

  expect(exploracion.estaCaminando).toBe(false);
  expect(avisos).toBe(0);
  expect(exploracion.posicion.x).toBeCloseTo(2.5, 5);
});

test('una dirección que ya estaba oprimida al dar la orden no la cancela', async () => {
  const { exploracion } = await crearExploracion();
  let avisos = 0;

  // El jugador viene caminando a la izquierda y, sin soltar la tecla, pide ir a un lugar (o hablar con alguien).
  exploracion.avanzar(0.25, { x: -1, y: 0 });
  exploracion.irA({ x: 4, y: 3 }, () => avisos++);
  for (let cuadro = 0; cuadro < 30; cuadro++) {
    exploracion.avanzar(0.05, { x: -1, y: 0 });
  }

  expect(avisos).toBe(1);
  expect(exploracion.posicion).toEqual({ x: 4, y: 3 });
});

test('después de soltar esa dirección, volver a oprimirla sí cancela la orden', async () => {
  const { exploracion } = await crearExploracion();
  let avisos = 0;

  exploracion.avanzar(0.25, { x: -1, y: 0 });
  exploracion.irA({ x: 8, y: 3 }, () => avisos++);
  exploracion.avanzar(0.25, { x: -1, y: 0 }); // sigue oprimida: no cuenta
  exploracion.avanzar(0.25); // la suelta
  exploracion.avanzar(0.25, { x: -1, y: 0 }); // la oprime otra vez: ahora sí manda
  exploracion.avanzar(5);

  expect(avisos).toBe(0);
  expect(exploracion.estaCaminando).toBe(false);
});
