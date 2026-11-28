import { expect, test } from 'bun:test';
import { AudioDeMemoria } from '../adaptadores/memoria/audio-de-memoria.ts';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { VozDelHost } from './voz-del-host.ts';
import { VozEnOrden } from './voz-en-orden.ts';

/** Deja correr las promesas pendientes, como si pasara un instante. */
function dejarCorrer(): Promise<void> {
  return new Promise((seguir) => setTimeout(seguir, 0));
}

/** Los problemas con los que rechaza `promesa`. */
async function problemasDe(promesa: Promise<void>): Promise<readonly string[]> {
  try {
    await promesa;
  } catch (error) {
    if (error instanceof ErrorDeEscenario) return error.problemas;
    throw error;
  }
  throw new Error('se esperaba un ErrorDeEscenario');
}

function crearVozDelHost(audio: AudioDeMemoria): { vozDelHost: VozDelHost; voz: VozEnOrden } {
  const voz = new VozEnOrden(audio, new RelojDeMemoria());
  const assets: Record<string, string> = { vo_bobby_corn: '/voz/vo_bobby_corn.mp3' };
  const vozDelHost = new VozDelHost({
    voz,
    direccionDeAsset: (clave) => (Object.hasOwn(assets, clave) ? assets[clave] : undefined),
  });
  return { vozDelHost, voz };
}

test('el host dice una frase con su idioma, su voz grabada y su tono, y la promesa termina al acabar', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost } = crearVozDelHost(audio);
  let termino = false;

  const dicho = vozDelHost.decir('corn', { idioma: 'en', clave: 'vo_bobby_corn', voz: { tono: 1.3 } }).then(() => {
    termino = true;
  });
  await dejarCorrer();
  expect(audio.frasesDichas).toEqual([
    { texto: 'corn', idioma: 'en', direccionDeLaVoz: '/voz/vo_bobby_corn.mp3', voz: { tono: 1.3, velocidad: 1 } },
  ]);
  expect(termino).toBe(false);

  audio.terminarDeHablar();
  await dicho;
  expect(termino).toBe(true);
});

test('lo que dice el host espera a que termine la línea del juego', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost, voz } = crearVozDelHost(audio);
  void voz.decir({ texto: 'Buenos días, doña Tepo', idioma: 'es' }, new AbortController().signal);

  void vozDelHost.decir('tomato', { idioma: 'en' });
  await dejarCorrer();
  expect(audio.frasesDichas.length).toBe(1);

  audio.terminarDeHablar();
  await dejarCorrer();
  expect(audio.frasesDichas[1]!.texto).toBe('tomato');
});

test('una frase nueva del host corta la anterior del host', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost } = crearVozDelHost(audio);

  const primera = vozDelHost.decir('corn', { idioma: 'en' });
  await dejarCorrer();
  void vozDelHost.decir('chili', { idioma: 'en' });
  await primera;
  await dejarCorrer();

  expect(audio.frasesDichas[1]!.texto).toBe('chili');
  expect(audio.hayAlguienHablando).toBe(true);
});

test('el host se oye aunque el juego esté en pausa', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost, voz } = crearVozDelHost(audio);
  voz.pausar();

  void vozDelHost.decir('¡Muy bien!', { idioma: 'es' });
  await dejarCorrer();
  expect(audio.hayAlguienHablando).toBe(true);
});

test('una clave que el nivel no tiene usa la voz sintetizada', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost } = crearVozDelHost(audio);

  void vozDelHost.decir('corn', { idioma: 'en', clave: 'vo_no_existe' });
  await dejarCorrer();
  expect(audio.frasesDichas[0]!.direccionDeLaVoz).toBeUndefined();
});

test('si el host llama mal a juego.decir, el error dice qué esperaba y qué llegó', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost } = crearVozDelHost(audio);

  expect(await problemasDe(vozDelHost.decir(5, { idioma: 'es' }))).toEqual([
    'juego.decir: el texto debe ser un texto; llegó 5',
  ]);
  expect(await problemasDe(vozDelHost.decir('corn', 'en'))).toEqual([
    `juego.decir("corn"): falta el segundo argumento, por ejemplo { idioma: 'en' }; llegó "en"`,
  ]);
  expect(await problemasDe(vozDelHost.decir('corn', { idioma: 'ingles', clave: 3, voz: { tono: 5 } }))).toEqual([
    'juego.decir("corn"): idioma debe ser "es" o "en"; llegó "ingles"',
    'juego.decir("corn"): clave debe ser la clave de un asset; llegó 3',
    'juego.decir("corn"): voz.tono va de 0.5 a 2; llegó 5',
  ]);
  expect(audio.frasesDichas).toEqual([]);
});

test('al destruir, la frase del host termina', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost } = crearVozDelHost(audio);
  const frase = vozDelHost.decir('corn', { idioma: 'en' });
  await dejarCorrer();

  vozDelHost.destruir();
  await frase;
  expect(audio.hayAlguienHablando).toBe(false);
});
