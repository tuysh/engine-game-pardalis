import { expect, test } from 'bun:test';
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
  const estadoInicial = crearEstadoDeNivel({ objetivos: ['tortillas'], variables: ['globo'], lista: {} }, { globo: 'rosa' });
  const piezas: PiezasDeEscena = {
    contenido: {
      meta: { id: 'barrio', titulo: 'El barrio', personajes: {} },
      mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
      estado: estadoInicial.declaracion,
      secuencias: {},
      npcs: {},
      interactivos: {},
      comentarios: {},
    },
    puntos: {},
    idiomaBase: 'es',
    escenario,
    interfaz,
    audio,
    reloj: new RelojDeMemoria(),
    reparto: new Reparto(escenario),
    estado: new EstadoEnJuego(estadoInicial, () => {}),
    minijuegos,
    direccionDeAsset: (clave) => (clave === 'comal' ? '/assets/img/comal.svg' : undefined),
    alVerPalabra: () => {},
  };
  return { piezas, interfaz, audio };
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
