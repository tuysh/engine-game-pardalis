import { expect, spyOn, test } from 'bun:test';
import { AudioDeMemoria } from '../adaptadores/memoria/audio-de-memoria.ts';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import { VocesDelNivel } from './voces-del-nivel.ts';
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

/** Las voces de un nivel con Bobby (que tiene su voz) y una sola voz grabada. */
function crearVocesDelNivel(): VocesDelNivel {
  const assets: Record<string, string> = { vo_bobby_corn: '/voz/vo_bobby_corn.mp3' };
  return new VocesDelNivel({
    personajes: { bobby: { idioma: 'en', sprite: 'spr_bobby', voz: { tono: 1.3, velocidad: 1.1 } } },
    direccionDeAsset: (clave) => (Object.hasOwn(assets, clave) ? assets[clave] : undefined),
  });
}

/**
 * La voz del host en un juego con un nivel en curso. `cambiarDeNivel()` hace como si cargara otro nivel
 * con las mismas voces, para ver que los avisos vuelven a salir.
 */
function crearVozDelHost(audio: AudioDeMemoria): {
  vozDelHost: VozDelHost;
  voz: VozEnOrden;
  cambiarDeNivel: () => void;
} {
  const voz = new VozEnOrden(audio, new RelojDeMemoria());
  let voces = crearVocesDelNivel();
  const vozDelHost = new VozDelHost({ voz, vocesDelNivel: () => voces });
  const cambiarDeNivel = (): void => {
    voces = crearVocesDelNivel();
  };
  return { vozDelHost, voz, cambiarDeNivel };
}

/** Corre `accion` anotando los avisos de la consola en vez de mostrarlos. */
async function avisosDe(accion: () => Promise<void>): Promise<string[]> {
  const avisos: string[] = [];
  const espia = spyOn(console, 'warn').mockImplementation((aviso: unknown) => {
    avisos.push(String(aviso));
  });
  try {
    await accion();
  } finally {
    espia.mockRestore();
  }
  return avisos;
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

  await avisosDe(async () => {
    void vozDelHost.decir('corn', { idioma: 'en', clave: 'vo_no_existe' });
    await dejarCorrer();
  });
  expect(audio.frasesDichas[0]!.direccionDeLaVoz).toBeUndefined();
});

test('una clave sin voz grabada se avisa una sola vez por nivel', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost, cambiarDeNivel } = crearVozDelHost(audio);

  const avisos = await avisosDe(async () => {
    void vozDelHost.decir('corn', { idioma: 'en', clave: 'vo_no_existe' });
    void vozDelHost.decir('corn', { idioma: 'en', clave: 'vo_no_existe' });
    cambiarDeNivel();
    void vozDelHost.decir('corn', { idioma: 'en', clave: 'vo_no_existe' });
    await dejarCorrer();
  });

  const aviso = '[escenario-engine] juego.decir: "vo_no_existe" no está en los assets del nivel; se usa voz sintetizada';
  expect(avisos).toEqual([aviso, aviso]);
});

test('con quien, el host dice la frase con la voz de ese personaje del nivel', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost } = crearVozDelHost(audio);

  void vozDelHost.decir('corn', { idioma: 'en', quien: 'bobby' });
  await dejarCorrer();
  expect(audio.frasesDichas[0]!.voz).toEqual({ tono: 1.3, velocidad: 1.1 });
});

test('si llegan voz y quien, gana voz', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost } = crearVozDelHost(audio);

  void vozDelHost.decir('corn', { idioma: 'en', quien: 'bobby', voz: { tono: 0.8 } });
  await dejarCorrer();
  expect(audio.frasesDichas[0]!.voz).toEqual({ tono: 0.8, velocidad: 1 });
});

test('un quien que no es personaje del nivel usa la voz normal y se avisa una vez', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost } = crearVozDelHost(audio);

  const avisos = await avisosDe(async () => {
    void vozDelHost.decir('hola', { idioma: 'es', quien: 'pardi' });
    void vozDelHost.decir('hola', { idioma: 'es', quien: 'pardi' });
    await dejarCorrer();
  });

  expect(audio.frasesDichas[0]!.voz).toBeUndefined();
  expect(avisos).toEqual([
    '[escenario-engine] juego.decir: "pardi" no es un personaje del nivel (meta.personajes); se usa la voz normal',
  ]);
});

test('callar corta la frase del host y la que esperaba su turno, pero no la línea del juego', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost, voz } = crearVozDelHost(audio);
  let lineaDelJuegoTermino = false;
  const lineaDelJuego = voz.decir({ texto: 'Buenos días', idioma: 'es' }, new AbortController().signal).then(() => {
    lineaDelJuegoTermino = true;
  });
  const fraseDelHost = vozDelHost.decir('corn', { idioma: 'en' });
  await dejarCorrer();

  vozDelHost.callar();
  await fraseDelHost;
  expect(lineaDelJuegoTermino).toBe(false);
  expect(audio.hayAlguienHablando).toBe(true);

  audio.terminarDeHablar();
  await lineaDelJuego;
  await dejarCorrer();
  expect(audio.frasesDichas.map((frase) => frase.texto)).toEqual(['Buenos días']);
});

test('callar corta la frase que el host está diciendo', async () => {
  const audio = new AudioDeMemoria();
  const { vozDelHost } = crearVozDelHost(audio);
  const frase = vozDelHost.decir('corn', { idioma: 'en' });
  await dejarCorrer();
  expect(audio.hayAlguienHablando).toBe(true);

  vozDelHost.callar();
  await frase;
  expect(audio.hayAlguienHablando).toBe(false);
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
  expect(await problemasDe(vozDelHost.decir('corn', { idioma: 'en', quien: 7 }))).toEqual([
    'juego.decir("corn"): quien debe ser el id de un personaje del nivel; llegó 7',
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
