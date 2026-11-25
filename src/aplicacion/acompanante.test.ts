import { expect, test } from 'bun:test';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { distanciaEntre } from '../dominio/geometria.ts';
import { crearMapaDeCaminos } from '../dominio/rejilla-de-caminos.ts';
import type { Terreno } from '../dominio/terreno.ts';
import type { ImagenDeEscena } from '../puertos/escenario.ts';
import { Acompanante } from './acompanante.ts';
import { Reparto } from './reparto.ts';

/** Una calle de 10 × 4 metros con un puesto en medio, que deja pasar solo por el frente (y > 3). */
const TERRENO: Terreno = {
  pisos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }]],
  obstaculos: [{ x: 4, y: 0, ancho: 2, alto: 3 }],
};

const IMAGEN: ImagenDeEscena = {
  direcciones: ['spr.svg'],
  cuadrosPorSegundo: 0,
  anchoEnPixeles: 90,
  altoEnPixeles: 160,
  anchoEnMetros: 0.9,
  altoEnMetros: 1.6,
};

/**
 * Tommy (el jugador) en (2, 1) y su primo Bobby en (1, 1). Quien acompaña a Tommy camina a 2 metros por segundo.
 * `idDelAcompananteInicial` es quién lo acompaña al empezar; `undefined` = nadie.
 */
async function crearAcompanante(idDelAcompananteInicial: string | undefined) {
  const escenario = new EscenarioDeMemoria();
  const reparto = new Reparto(escenario);
  await reparto.agregar({ id: 'tommy', imagen: IMAGEN, posicion: { x: 2, y: 1 }, mira: 'derecha', sePuedeTocar: false });
  await reparto.agregar({ id: 'bobby', imagen: IMAGEN, posicion: { x: 1, y: 1 }, mira: 'derecha', sePuedeTocar: true });
  const acompanante = new Acompanante({
    reparto,
    caminos: crearMapaDeCaminos(TERRENO),
    idDelJugador: 'tommy',
    velocidadEnMetrosPorSegundo: 2,
    idDelAcompananteInicial,
  });
  return { acompanante, reparto, escenario };
}

/** Avanza varios cuadros de 20 milésimas de segundo. */
function avanzarCuadros(acompanante: Acompanante, cuadros: number): void {
  for (let cuadro = 0; cuadro < cuadros; cuadro++) {
    acompanante.avanzar(0.02);
  }
}

test('mientras el jugador está cerca, el acompañante no se mueve', async () => {
  const { acompanante, reparto } = await crearAcompanante('bobby');

  avanzarCuadros(acompanante, 50);

  expect(reparto.posicionDe('bobby')).toEqual({ x: 1, y: 1 });
});

test('cuando el jugador se aleja, lo alcanza y se detiene cerca, sin encimarse', async () => {
  const { acompanante, reparto } = await crearAcompanante('bobby');

  reparto.mover('tommy', { x: 3.5, y: 3.5 });
  avanzarCuadros(acompanante, 200);

  const distancia = distanciaEntre(reparto.posicionDe('bobby')!, { x: 3.5, y: 3.5 });
  expect(distancia).toBeLessThanOrEqual(0.9);
  expect(distancia).toBeGreaterThan(0.5);
});

test('rodea lo que estorba para alcanzar al jugador y voltea hacia donde camina', async () => {
  const { acompanante, reparto, escenario } = await crearAcompanante('bobby');
  let atravesoElPuesto = false;

  reparto.mover('tommy', { x: 9, y: 1 }); // del otro lado del puesto
  for (let cuadro = 0; cuadro < 500; cuadro++) {
    acompanante.avanzar(0.02);
    const posicion = reparto.posicionDe('bobby')!;
    if (posicion.x > 4 && posicion.x < 6 && posicion.y < 3) {
      atravesoElPuesto = true;
    }
  }

  expect(atravesoElPuesto).toBe(false);
  expect(distanciaEntre(reparto.posicionDe('bobby')!, { x: 9, y: 1 })).toBeLessThanOrEqual(0.9);
  expect(escenario.personajes.get('bobby')?.mira).toBe('derecha');
});

test('sin acompañante nadie sigue al jugador, y un cambio lo pone o lo quita', async () => {
  const { acompanante, reparto } = await crearAcompanante(undefined);

  reparto.mover('tommy', { x: 3.5, y: 3.5 });
  avanzarCuadros(acompanante, 100);
  expect(reparto.posicionDe('bobby')).toEqual({ x: 1, y: 1 });

  acompanante.cambiar('bobby');
  avanzarCuadros(acompanante, 200);
  expect(distanciaEntre(reparto.posicionDe('bobby')!, { x: 3.5, y: 3.5 })).toBeLessThanOrEqual(0.9);

  acompanante.cambiar(undefined);
  reparto.mover('tommy', { x: 1, y: 3.5 });
  const dondeSeQuedo = reparto.posicionDe('bobby');
  avanzarCuadros(acompanante, 100);
  expect(reparto.posicionDe('bobby')).toEqual(dondeSeQuedo);
});

test('si quien acompaña todavía no entra al escenario, no pasa nada', async () => {
  const { acompanante, reparto } = await crearAcompanante('mama');

  reparto.mover('tommy', { x: 3.5, y: 3.5 });
  avanzarCuadros(acompanante, 50);

  expect(reparto.posicionDe('bobby')).toEqual({ x: 1, y: 1 });
});
