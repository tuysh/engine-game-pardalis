import { expect, test } from 'bun:test';
import { PausaDelJuego } from './pausa-del-juego.ts';
import type { Pausable } from './pausa-del-juego.ts';

/** Algo pausable de mentira que recuerda si está corriendo. */
class PausableDePrueba implements Pausable {
  estaCorriendo = true;

  pausar(): void {
    this.estaCorriendo = false;
  }

  reanudar(): void {
    this.estaCorriendo = true;
  }
}

function crearPausa() {
  const reloj = new PausableDePrueba();
  const audio = new PausableDePrueba();
  const pausa = new PausaDelJuego(reloj, [audio]);
  return { pausa, reloj, audio };
}

test('pausar congela el tiempo y lo que suena, y reanudar los devuelve', () => {
  const { pausa, reloj, audio } = crearPausa();

  pausa.pausar();
  expect(reloj.estaCorriendo).toBe(false);
  expect(audio.estaCorriendo).toBe(false);

  pausa.reanudar();
  expect(reloj.estaCorriendo).toBe(true);
  expect(audio.estaCorriendo).toBe(true);
});

test('mientras se espera el botón de inicio, el tiempo no pasa hasta que lo tocan', () => {
  const { pausa, reloj } = crearPausa();

  pausa.esperarElInicio();
  expect(reloj.estaCorriendo).toBe(false);

  pausa.empezar();
  expect(reloj.estaCorriendo).toBe(true);
});

test('reanudar una pausa no echa a andar el tiempo si todavía no tocan el botón de inicio', () => {
  const { pausa, reloj } = crearPausa();
  pausa.esperarElInicio();

  pausa.pausar();
  pausa.reanudar();

  expect(reloj.estaCorriendo).toBe(false);
});

test('tocar el botón de inicio no echa a andar el tiempo si alguien tiene el juego en pausa', () => {
  const { pausa, reloj } = crearPausa();
  pausa.esperarElInicio();
  pausa.pausar();

  pausa.empezar();
  expect(reloj.estaCorriendo).toBe(false);

  pausa.reanudar();
  expect(reloj.estaCorriendo).toBe(true);
});
