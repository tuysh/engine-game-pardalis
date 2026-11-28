import { expect, test } from 'bun:test';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { leerCondicionDeTexto } from '../dominio/condicion.ts';
import { crearEstadoDeNivel } from '../dominio/estado.ts';
import type { Decorado } from '../dominio/mundo.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';
import { VisibilidadDelDecorado } from './visibilidad-del-decorado.ts';

/** Una banca que siempre se ve, el letrero de las verduras (se quita al comprarlas) y una flecha del final. */
const DECORADO: readonly Decorado[] = [
  { descripcion: 'objeto #1 "Banca"', clase: 'parado', asset: 'banca', huella: { x: 1, y: 1, ancho: 1, alto: 0.4 }, alturaEnMetros: 0 },
  {
    descripcion: 'objeto #2 "Letrero"',
    clase: 'colgado',
    asset: 'letrero',
    huella: { x: 3, y: 1, ancho: 1, alto: 0.1 },
    alturaEnMetros: 2,
    visibleCuando: leerCondicionDeTexto('no tengo verduras'),
  },
  {
    descripcion: 'objeto #3 "Flecha"',
    clase: 'plano',
    asset: 'flecha',
    huella: { x: 5, y: 3, ancho: 1, alto: 1 },
    alturaEnMetros: 0,
    visibleCuando: leerCondicionDeTexto('objetivosCompletos'),
  },
];

function crearVisibilidad() {
  const escenario = new EscenarioDeMemoria();
  const declaracion = { objetivos: ['verduras'], variables: [], lista: {} };
  const estado = new EstadoEnJuego(crearEstadoDeNivel(declaracion), () => {});
  const visibilidad = new VisibilidadDelDecorado({ decorado: DECORADO, estado, escenario });
  return { visibilidad, escenario, estado };
}

test('al empezar, lo que no cumple su visibleCuando se esconde y lo demás sigue a la vista', () => {
  const { visibilidad, escenario } = crearVisibilidad();

  visibilidad.actualizar();

  expect([...escenario.decoradoOculto]).toEqual([2]);
});

test('cuando cambia el estado, el letrero se quita y la flecha aparece', () => {
  const { visibilidad, escenario, estado } = crearVisibilidad();
  visibilidad.actualizar();

  estado.aplicar({ verduras: true });
  visibilidad.actualizar();

  expect([...escenario.decoradoOculto]).toEqual([1]);
});
