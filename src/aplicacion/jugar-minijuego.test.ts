import { expect, test } from 'bun:test';
import { crearMapaDeCaminos } from '../dominio/rejilla-de-caminos.ts';
import { AudioDeMemoria } from '../adaptadores/memoria/audio-de-memoria.ts';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { InterfazDeMemoria } from '../adaptadores/memoria/interfaz-de-memoria.ts';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import { crearEstadoDeNivel } from '../dominio/estado.ts';
import type { ContextoDeMinijuego, Minijuego, ResultadoDeMinijuego } from '../puertos/minijuego.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';
import { jugarMinijuego } from './jugar-minijuego.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';
import { Reparto } from './reparto.ts';

/** Una escena con adaptadores falsos donde el host registró esos minijuegos. El jugador ya tiene un globo. */
function crearEscena(minijuegos: Record<string, Minijuego>) {
  const escenario = new EscenarioDeMemoria();
  const interfaz = new InterfazDeMemoria();
  const audio = new AudioDeMemoria();
  const avisos: string[] = [];
  const reloj = new RelojDeMemoria();
  const estadoInicial = crearEstadoDeNivel({ objetivos: ['tortillas'], variables: ['globo'], lista: {} }, { globo: 'rosa' });
  const piezas: PiezasDeEscena = {
    contenido: {
      meta: { id: 'barrio', titulo: 'El barrio', personajes: {} },
      mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
      estado: estadoInicial.declaracion,
      secuencias: {},
      npcs: {},
      interactivos: {},
      cinematicas: {},
      comentarios: {},
    },
    caminos: crearMapaDeCaminos({ pisos: [], obstaculos: [] }),
    puntos: {},
    centroDelLugar: { x: 5, y: 2 },
    idiomaBase: 'es',
    escenario,
    interfaz,
    audio,
    reloj,
    reparto: new Reparto(escenario),
    estado: new EstadoEnJuego(estadoInicial, () => {}),
    minijuegos,
    direccionDeAsset: (clave) => (clave === 'comal' ? '/assets/img/comal.svg' : undefined),
    azar: () => 0.25,
    imagenDeAsset: (clave) => ({
      direcciones: [`/img/${clave}.svg`],
      cuadrosPorSegundo: 0,
      anchoEnPixeles: 90,
      altoEnPixeles: 160,
      anchoEnMetros: 0.9,
      altoEnMetros: 1.6,
    }),
    alVerPalabra: () => {},
    alEmpezarMinijuego: (nombre) => avisos.push(`inicio ${nombre}`),
    alTerminarMinijuego: (nombre) => avisos.push(`fin ${nombre}`),
  };
  return { piezas, interfaz, audio, avisos, reloj };
}

const SIN_INTERRUMPIR = new AbortController().signal;

test('llama al minijuego del host con su config y devuelve su resultado', async () => {
  const configsRecibidas: unknown[] = [];
  const Tortilleria: Minijuego = async (contexto) => {
    configsRecibidas.push(contexto.config);
    return { exito: true, otorgar: { tortillas: true } };
  };
  const { piezas } = crearEscena({ Tortilleria });

  const resultado = await jugarMinijuego({ nombre: 'Tortilleria', config: { palabras: ['hot'] } }, SIN_INTERRUMPIR, piezas);

  expect(resultado).toEqual({ exito: true, otorgar: { tortillas: true } });
  expect(configsRecibidas).toEqual([{ palabras: ['hot'] }]);
});

test('abre el espacio del minijuego mientras se juega y lo cierra al terminar', async () => {
  let terminar = (resultado: ResultadoDeMinijuego): void => {};
  const Tortilleria: Minijuego = () => new Promise((resolver) => (terminar = resolver));
  const { piezas, interfaz } = crearEscena({ Tortilleria });

  const juego = jugarMinijuego({ nombre: 'Tortilleria', config: undefined }, SIN_INTERRUMPIR, piezas);
  expect(interfaz.hayEspacioDeMinijuego).toBe(true);
  terminar({ exito: true });
  await juego;

  expect(interfaz.hayEspacioDeMinijuego).toBe(false);
});

test('el minijuego puede leer el estado del nivel, pero no cambiarlo', async () => {
  let contextoRecibido: ContextoDeMinijuego | undefined;
  const Tortilleria: Minijuego = async (contexto) => {
    contextoRecibido = contexto;
    return { exito: true };
  };
  const { piezas } = crearEscena({ Tortilleria });

  await jugarMinijuego({ nombre: 'Tortilleria', config: undefined }, SIN_INTERRUMPIR, piezas);

  expect(contextoRecibido?.estado.obtener('globo')).toBe('rosa');
  expect(contextoRecibido?.estado.obtener('tortillas')).toBeUndefined();
  expect(contextoRecibido?.estado.cumple('tengo globo')).toBe(true);
  expect(contextoRecibido?.estado.cumple('no tengo tortillas')).toBe(true);
});

test('el minijuego puede pedir la dirección de un asset y decir palabras en voz alta', async () => {
  const direcciones: string[] = [];
  const Tortilleria: Minijuego = async (contexto) => {
    direcciones.push(contexto.assets.url('comal'));
    direcciones.push(contexto.assets.url('no_existe'));
    contexto.audio.decir('hot', 'en');
    contexto.audio.tocar('comal');
    return { exito: true };
  };
  const { piezas, audio } = crearEscena({ Tortilleria });

  await jugarMinijuego({ nombre: 'Tortilleria', config: undefined }, SIN_INTERRUMPIR, piezas);

  expect(direcciones).toEqual(['/assets/img/comal.svg', '']);
  expect(audio.frasesDichas).toEqual([{ texto: 'hot', idioma: 'en', direccionDeLaVoz: undefined }]);
  expect(audio.sonidosTocados).toEqual(['/assets/img/comal.svg']);
});

test('si el minijuego lanza un error, cuenta como sin éxito y su espacio se cierra', async () => {
  const Tortilleria: Minijuego = async () => {
    throw new Error('se rompió el comal');
  };
  const { piezas, interfaz } = crearEscena({ Tortilleria });

  const resultado = await jugarMinijuego({ nombre: 'Tortilleria', config: undefined }, SIN_INTERRUMPIR, piezas);

  expect(resultado).toEqual({ exito: false });
  expect(interfaz.hayEspacioDeMinijuego).toBe(false);
});

test('el resultado del host se limpia: solo exito verdadero cuenta, y en otorgar solo valores simples', async () => {
  // El host podría devolver cualquier cosa; por eso el minijuego falso no respeta el tipo.
  const resultadoMalFormado = { exito: 'sí', otorgar: { tortillas: true, lista: ['a'], nada: null, cuantas: 3 } };
  const Tortilleria: Minijuego = async () => resultadoMalFormado as unknown as ResultadoDeMinijuego;
  const { piezas } = crearEscena({ Tortilleria });

  const resultado = await jugarMinijuego({ nombre: 'Tortilleria', config: undefined }, SIN_INTERRUMPIR, piezas);

  expect(resultado).toEqual({ exito: false, otorgar: { tortillas: true, cuantas: 3 } });
});

test('si el diálogo se interrumpe y el minijuego nunca termina, su espacio se cierra y se le avisa', async () => {
  let senalDelMinijuego: AbortSignal | undefined;
  const Tortilleria: Minijuego = (contexto) => {
    senalDelMinijuego = contexto.senal;
    return new Promise(() => {}); // un minijuego que ignora la cancelación
  };
  const { piezas, interfaz } = crearEscena({ Tortilleria });
  const interrupcion = new AbortController();

  const juego = jugarMinijuego({ nombre: 'Tortilleria', config: undefined }, interrupcion.signal, piezas);
  interrupcion.abort();
  const resultado = await juego;

  expect(resultado).toEqual({ exito: false });
  expect(interfaz.hayEspacioDeMinijuego).toBe(false);
  expect(senalDelMinijuego?.aborted).toBe(true);
});

test('al terminar bien, también se dispara la señal del minijuego para que limpie lo suyo', async () => {
  let senalDelMinijuego: AbortSignal | undefined;
  const Tortilleria: Minijuego = async (contexto) => {
    senalDelMinijuego = contexto.senal;
    return { exito: true };
  };
  const { piezas } = crearEscena({ Tortilleria });

  await jugarMinijuego({ nombre: 'Tortilleria', config: undefined }, SIN_INTERRUMPIR, piezas);

  expect(senalDelMinijuego?.aborted).toBe(true);
});

test('un minijuego que el host no registró cuenta como sin éxito y no abre nada', async () => {
  const { piezas, interfaz } = crearEscena({});

  const resultado = await jugarMinijuego({ nombre: 'Fruteria', config: undefined }, SIN_INTERRUMPIR, piezas);

  expect(resultado).toEqual({ exito: false });
  expect(interfaz.hayEspacioDeMinijuego).toBe(false);
});

test('lo que otorga un minijuego puede ser una suma o una resta, y una cuenta mal escrita se descarta', async () => {
  // El host podría devolver cualquier cosa; por eso el minijuego falso no respeta el tipo.
  const resultadoDelHost = { exito: true, otorgar: { dinero: { resta: 15 }, estrellas: { suma: 1 }, raro: { doble: 2 } } };
  const Cobro: Minijuego = async () => resultadoDelHost as unknown as ResultadoDeMinijuego;
  const { piezas } = crearEscena({ Cobro });

  const resultado = await jugarMinijuego({ nombre: 'Cobro', config: undefined }, SIN_INTERRUMPIR, piezas);

  expect(resultado).toEqual({ exito: true, otorgar: { dinero: { resta: 15 }, estrellas: { suma: 1 } } });
});

test('avisa cuando el minijuego empieza y cuando termina, también si falla', async () => {
  let terminar = (resultado: ResultadoDeMinijuego): void => {};
  const Tortilleria: Minijuego = () => new Promise((resolver) => (terminar = resolver));
  const Roto: Minijuego = async () => {
    throw new Error('se rompió');
  };
  const { piezas, avisos } = crearEscena({ Tortilleria, Roto });

  const juego = jugarMinijuego({ nombre: 'Tortilleria', config: undefined }, SIN_INTERRUMPIR, piezas);
  expect(avisos).toEqual(['inicio Tortilleria']);
  terminar({ exito: true });
  await juego;
  await jugarMinijuego({ nombre: 'Roto', config: undefined }, SIN_INTERRUMPIR, piezas);

  expect(avisos).toEqual(['inicio Tortilleria', 'fin Tortilleria', 'inicio Roto', 'fin Roto']);
});

test('decir termina cuando la voz acaba: dos frases se encadenan con await', async () => {
  const Verduras: Minijuego = async ({ audio }) => {
    await audio.decir('¡Lechuga!', 'es');
    await audio.decir('lettuce!', 'en');
    return { exito: true };
  };
  const { piezas, audio, reloj } = crearEscena({ Verduras });

  const juego = jugarMinijuego({ nombre: 'Verduras', config: undefined }, SIN_INTERRUMPIR, piezas);
  await reloj.avanzar(0);
  // La segunda frase espera a que termine la primera.
  expect(audio.frasesDichas).toEqual([{ texto: '¡Lechuga!', idioma: 'es', direccionDeLaVoz: undefined }]);

  audio.terminarDeHablar();
  await reloj.avanzar(0);
  expect(audio.frasesDichas).toHaveLength(2);
  audio.terminarDeHablar();

  expect(await juego).toEqual({ exito: true });
});

test('una frase nueva corta la que estaba sonando, y la promesa de la que se cortó termina', async () => {
  let primeraTermino = false;
  let terminar = (resultado: ResultadoDeMinijuego): void => {};
  const Verduras: Minijuego = ({ audio }) => {
    void audio.decir('una frase muy larga', 'es').then(() => {
      primeraTermino = true;
    });
    void audio.decir('¡Ya!', 'es');
    return new Promise((resolver) => (terminar = resolver));
  };
  const { piezas, audio, reloj } = crearEscena({ Verduras });

  const juego = jugarMinijuego({ nombre: 'Verduras', config: undefined }, SIN_INTERRUMPIR, piezas);
  await reloj.avanzar(0);

  expect(primeraTermino).toBe(true);
  expect(audio.hayAlguienHablando).toBe(true);
  terminar({ exito: true });
  await juego;
  // Al cerrarse el minijuego, la voz se calla.
  expect(audio.hayAlguienHablando).toBe(false);
});

test('si la voz sintetizada nunca avisa que terminó, decir termina de todos modos', async () => {
  let termino = false;
  let terminar = (resultado: ResultadoDeMinijuego): void => {};
  const Verduras: Minijuego = ({ audio }) => {
    void audio.decir('lettuce!', 'en').then(() => {
      termino = true;
    });
    return new Promise((resolver) => (terminar = resolver));
  };
  const { piezas, reloj } = crearEscena({ Verduras });

  const juego = jugarMinijuego({ nombre: 'Verduras', config: undefined }, SIN_INTERRUMPIR, piezas);
  await reloj.avanzar(10);

  expect(termino).toBe(true);
  terminar({ exito: true });
  await juego;
});

test('el minijuego recibe el azar del motor y puede tocar tonos sin archivo', async () => {
  const numeros: number[] = [];
  const Rascadita: Minijuego = async ({ azar, audio }) => {
    numeros.push(azar());
    audio.tocarTono(880, 0.2);
    audio.tocarTono(-1, 0.2);
    return { exito: true };
  };
  const { piezas, audio } = crearEscena({ Rascadita });

  await jugarMinijuego({ nombre: 'Rascadita', config: undefined }, SIN_INTERRUMPIR, piezas);

  expect(numeros).toEqual([0.25]);
  // El tono con una frecuencia que no sirve se ignora con una advertencia.
  expect(audio.tonosTocados).toEqual([880]);
});

test('el minijuego puede tocar un sonido más bajito o más agudo, y una opción que no sirve se ignora', async () => {
  const Chiles: Minijuego = async ({ audio }) => {
    audio.tocar('comal', { tono: 1.2 });
    audio.tocar('comal', { volumen: 0.3, tono: 9 });
    audio.tocar('comal');
    return { exito: true };
  };
  const { piezas, audio } = crearEscena({ Chiles });

  await jugarMinijuego({ nombre: 'Chiles', config: undefined }, SIN_INTERRUMPIR, piezas);

  expect(audio.sonidosConOpciones).toEqual([
    { direccion: '/assets/img/comal.svg', opciones: { volumen: undefined, tono: 1.2 } },
    { direccion: '/assets/img/comal.svg', opciones: { volumen: 0.3, tono: undefined } },
    { direccion: '/assets/img/comal.svg', opciones: undefined },
  ]);
});
