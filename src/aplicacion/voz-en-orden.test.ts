import { expect, test } from 'bun:test';
import { AudioDeMemoria } from '../adaptadores/memoria/audio-de-memoria.ts';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import { VozEnOrden } from './voz-en-orden.ts';

/** Deja correr las promesas pendientes, como si pasara un instante. */
function dejarCorrer(): Promise<void> {
  return new Promise((seguir) => setTimeout(seguir, 0));
}

function textosDichos(audio: AudioDeMemoria): string[] {
  const textos: string[] = [];
  for (const frase of audio.frasesDichas) {
    textos.push(frase.texto);
  }
  return textos;
}

test('una frase del host espera a que termine la del juego, sin cortarla', async () => {
  const audio = new AudioDeMemoria();
  const voz = new VozEnOrden(audio, new RelojDeMemoria());
  const sinCortar = new AbortController().signal;

  const delJuego = voz.decir({ texto: 'Hola, Tommy', idioma: 'es' }, sinCortar);
  let terminoLaDelHost = false;
  const delHost = voz.decirDelHost({ texto: 'lettuce', idioma: 'en' }, sinCortar).then(() => {
    terminoLaDelHost = true;
  });
  await dejarCorrer();
  expect(textosDichos(audio)).toEqual(['Hola, Tommy']);

  audio.terminarDeHablar();
  expect(await delJuego).toBe('dicho');
  await dejarCorrer();
  expect(textosDichos(audio)).toEqual(['Hola, Tommy', 'lettuce']);
  expect(terminoLaDelHost).toBe(false);

  audio.terminarDeHablar();
  await delHost;
  expect(terminoLaDelHost).toBe(true);
});

test('una frase que se cancela mientras espera sale de la fila y nunca se dice', async () => {
  const audio = new AudioDeMemoria();
  const voz = new VozEnOrden(audio, new RelojDeMemoria());
  const sinCortar = new AbortController().signal;
  const cancelacion = new AbortController();

  void voz.decir({ texto: 'primera', idioma: 'es' }, sinCortar);
  const cancelada = voz.decir({ texto: 'segunda', idioma: 'es' }, cancelacion.signal);
  void voz.decir({ texto: 'tercera', idioma: 'es' }, sinCortar);
  await dejarCorrer();

  cancelacion.abort();
  expect(await cancelada).toBe('dicho');
  audio.terminarDeHablar();
  await dejarCorrer();
  expect(textosDichos(audio)).toEqual(['primera', 'tercera']);
});

test('al pausar, la frase del juego se corta y al reanudar se dice otra vez desde el principio', async () => {
  const audio = new AudioDeMemoria();
  const voz = new VozEnOrden(audio, new RelojDeMemoria());
  let termino = false;
  const frase = voz.decir({ texto: 'Vamos al mercado', idioma: 'es' }, new AbortController().signal).then(() => {
    termino = true;
  });
  await dejarCorrer();

  voz.pausar();
  await dejarCorrer();
  expect(audio.estaPausado).toBe(true);
  expect(audio.hayAlguienHablando).toBe(false);
  expect(termino).toBe(false);

  voz.reanudar();
  await dejarCorrer();
  expect(textosDichos(audio)).toEqual(['Vamos al mercado', 'Vamos al mercado']);
  audio.terminarDeHablar();
  await frase;
  expect(termino).toBe(true);
});

test('con el juego en pausa el host sí puede hablar, y la frase cortada del juego espera a que se reanude', async () => {
  const audio = new AudioDeMemoria();
  const voz = new VozEnOrden(audio, new RelojDeMemoria());
  const sinCortar = new AbortController().signal;
  void voz.decir({ texto: 'Buenos días', idioma: 'es' }, sinCortar);
  await dejarCorrer();

  voz.pausar();
  const delHost = voz.decirDelHost({ texto: 'corn', idioma: 'en' }, sinCortar);
  void voz.decir({ texto: 'otra del juego', idioma: 'es' }, sinCortar);
  await dejarCorrer();
  expect(textosDichos(audio)).toEqual(['Buenos días', 'corn']);

  audio.terminarDeHablar();
  await delHost;
  await dejarCorrer();
  expect(textosDichos(audio)).toEqual(['Buenos días', 'corn']);

  voz.reanudar();
  await dejarCorrer();
  // La frase cortada vuelve primero, antes de la que pidió el juego después.
  expect(textosDichos(audio)).toEqual(['Buenos días', 'corn', 'Buenos días']);
});

test('una frase del host no se corta al pausar', async () => {
  const audio = new AudioDeMemoria();
  const voz = new VozEnOrden(audio, new RelojDeMemoria());
  void voz.decirDelHost({ texto: 'tomato', idioma: 'en' }, new AbortController().signal);
  await dejarCorrer();

  voz.pausar();
  await dejarCorrer();
  expect(audio.hayAlguienHablando).toBe(true);
  expect(textosDichos(audio)).toEqual(['tomato']);
});

test('al destruir, terminan las frases que esperaban su turno', async () => {
  const audio = new AudioDeMemoria();
  const voz = new VozEnOrden(audio, new RelojDeMemoria());
  const sinCortar = new AbortController().signal;
  const primera = voz.decir({ texto: 'primera', idioma: 'es' }, sinCortar);
  const segunda = voz.decirDelHost({ texto: 'segunda', idioma: 'es' }, sinCortar);
  await dejarCorrer();

  voz.destruir();
  expect(await primera).toBe('dicho');
  expect(await segunda).toBe('dicho');
  expect(audio.estaDestruido).toBe(true);
  expect(textosDichos(audio)).toEqual(['primera']);
});

test('el tope de tiempo de una frase empieza a contar cuando le toca hablar, no mientras espera', async () => {
  const audio = new AudioDeMemoria();
  const reloj = new RelojDeMemoria();
  const voz = new VozEnOrden(audio, reloj);
  const sinCortar = new AbortController().signal;
  void voz.decir({ texto: 'Una frase larga del juego', idioma: 'es' }, sinCortar);
  let terminoLaDelHost = false;
  void voz.decirDelHost({ texto: 'corn', idioma: 'en' }, sinCortar).then(() => {
    terminoLaDelHost = true;
  });
  await dejarCorrer();

  // La del juego dura 5 segundos; la del host espera todo ese tiempo detrás de ella.
  await reloj.avanzar(5);
  audio.terminarDeHablar();
  await dejarCorrer();
  expect(textosDichos(audio)).toEqual(['Una frase larga del juego', 'corn']);

  // La del host todavía tiene sus 6 segundos completos: a los 5 sigue hablando.
  await reloj.avanzar(5);
  expect(terminoLaDelHost).toBe(false);
  expect(audio.hayAlguienHablando).toBe(true);
  await reloj.avanzar(1.1);
  expect(terminoLaDelHost).toBe(true);
});
