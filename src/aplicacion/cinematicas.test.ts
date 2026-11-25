import { expect, test } from 'bun:test';
import { AudioDeMemoria } from '../adaptadores/memoria/audio-de-memoria.ts';
import { CargadorDeMemoria } from '../adaptadores/memoria/cargador-de-memoria.ts';
import { ControlesDeMemoria } from '../adaptadores/memoria/controles-de-memoria.ts';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { InterfazDeMemoria } from '../adaptadores/memoria/interfaz-de-memoria.ts';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import { VideoDeMemoria } from '../adaptadores/memoria/video-de-memoria.ts';
import { leerCondicionDeTexto } from '../dominio/condicion.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import type { Cinematica } from '../dominio/contenido.ts';
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import type { VariablesDeEstado } from '../dominio/estado.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { Paso } from '../dominio/paso.ts';
import type { CinematicaEnCodigo } from '../puertos/cinematica-en-codigo.ts';
import { jugarNivel } from './jugar-nivel.ts';

/**
 * Una sala de 10 × 4 metros. Tommy (el jugador) empieza en (2, 3) y camina a 2 metros por segundo.
 * Mamá no está en el mapa: entra con un paso `aparece`. La puerta está en (9, 2) y el sillón en (5, 2),
 * así que mamá tarda 2 segundos en ir de la puerta al sillón. La zona "entrada" es la franja derecha de la sala.
 */
const SALA: Nivel = {
  descripcion: { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.'] },
  contenido: {
    meta: {
      id: 'casa',
      titulo: 'La casa',
      personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' }, mama: { idioma: 'es', sprite: 'spr_mama' } },
    },
    jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2 },
    mundo: {
      ...AJUSTES_DEL_MUNDO_POR_DEFECTO,
      planos: { plano_puerta: { mira: 'puerta', distanciaEnMetros: 4, alturaEnMetros: 2, giroEnGrados: 0 } },
    },
    estado: { objetivos: ['tortillas'], variables: ['saludo'], lista: {} },
    secuencias: {},
    npcs: {},
    interactivos: {},
    cinematicas: {},
    comentarios: {},
  },
  mundo: {
    anchoEnMetros: 10,
    profundidadEnMetros: 4,
    telones: [],
    decorado: [],
    npcs: {},
    iniciosDelJugador: [{ descripcion: 'inicio', posicion: { x: 2, y: 3 }, mira: 'derecha' }],
    puntos: { puerta: { x: 9, y: 2 }, sillon: { x: 5, y: 2 } },
    zonas: {
      entrada: {
        descripcion: 'entrada',
        forma: { tipo: 'rectangulo', rectangulo: { x: 7, y: 0, ancho: 3, alto: 4 } },
        esperaEnSegundos: 20,
      },
    },
    pisos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }]],
  },
  assets: {
    spr_tommy: { carpeta: '.', asset: { tipo: 'imagen', archivo: 'img/spr_tommy.svg', anchoEnPixeles: 90, altoEnPixeles: 160 } },
    spr_mama: { carpeta: '.', asset: { tipo: 'imagen', archivo: 'img/spr_mama.svg', anchoEnPixeles: 110, altoEnPixeles: 170 } },
  },
};

/** Mamá entra por la puerta, camina al sillón y pide las tortillas. */
const PASOS_DE_LA_INTRO: readonly Paso[] = [
  { tipo: 'aparece', personaje: 'mama', punto: 'puerta' },
  { tipo: 'camina', personaje: 'mama', punto: 'sillon' },
  { tipo: 'linea', hablante: 'mama', texto: '¿Me traes tortillas, mijo?' },
  { tipo: 'pon', valores: { saludo: true } },
];

/** Una cinemática con sus valores más comunes: se ve una sola vez y se puede saltar. */
function crearCinematica(id: string, datos: Partial<Cinematica>): Cinematica {
  return {
    inicio: { tipo: 'alEntrar' },
    condicion: leerCondicionDeTexto(`no vista.${id}`),
    saltable: true,
    guion: { tipo: 'pasos', pasos: PASOS_DE_LA_INTRO },
    ...datos,
  };
}

function salaCon(cinematicas: Record<string, Cinematica>): Nivel {
  return { ...SALA, contenido: { ...SALA.contenido, cinematicas } };
}

interface OpcionesDePrueba {
  readonly variablesGuardadas?: VariablesDeEstado;
  readonly cinematicasEnCodigo?: Record<string, CinematicaEnCodigo>;
  /** Con `true`, avisar del inicio de una cinemática lanza un error, como un host que escucha mal el evento. */
  readonly fallaAlAvisarDelInicio?: boolean;
}

/** Pone a jugar un nivel con adaptadores falsos y anota en listas todo lo que el nivel avisa. */
async function empezar(nivel: Nivel, opciones: OpcionesDePrueba = {}) {
  const escenario = new EscenarioDeMemoria();
  const interfaz = new InterfazDeMemoria();
  const audio = new AudioDeMemoria();
  const video = new VideoDeMemoria();
  const controles = new ControlesDeMemoria();
  const reloj = new RelojDeMemoria();
  /** Cada cinemática que empieza o termina, por ejemplo `'inicio intro'`. */
  const avisosDeCinematicas: string[] = [];
  const salidas: string[] = [];
  const fallas: unknown[] = [];
  /** Las palabras de vocabulario que el nivel avisó que se mostraron. */
  const palabras: unknown[] = [];

  const ubicacion = { direccionDelNivel: '/niveles/casa/nivel.json', cargador: new CargadorDeMemoria({}) };
  const nivelEnJuego = await jugarNivel(
    {
      nivel,
      ubicacion,
      idiomaBase: 'es',
      minijuegos: {},
      cinematicasEnCodigo: opciones.cinematicasEnCodigo,
      variablesGuardadas: opciones.variablesGuardadas,
    },
    { escenario, interfaz, audio, video, controles, reloj, azar: () => 0 },
    {
      alCumplirObjetivo: () => {},
      alVerPalabra: (palabra) => palabras.push(palabra),
      alSalir: (destino) => salidas.push(destino),
      alFallar: (error) => fallas.push(error),
      alEmpezarCinematica: (id) => {
        avisosDeCinematicas.push(`inicio ${id}`);
        if (opciones.fallaAlAvisarDelInicio === true) {
          throw new Error('falló quien escuchaba el inicio');
        }
      },
      alTerminarCinematica: (id) => avisosDeCinematicas.push(`fin ${id}`),
      alCambiarElEstado: () => {},
      alEmpezarMinijuego: () => {},
      alTerminarMinijuego: () => {},
    },
  );
  const adaptadores = { escenario, interfaz, audio, video, controles, reloj };
  return { nivelEnJuego, ...adaptadores, avisosDeCinematicas, salidas, fallas, palabras };
}

test('una cinemática de entrada empieza en el primer cuadro: se ven las franjas y el nivel avisa', async () => {
  const { escenario, interfaz, reloj, avisosDeCinematicas } = await empezar(salaCon({ intro: crearCinematica('intro', {}) }));
  expect(interfaz.hayFranjasDeCine).toBe(false);

  await reloj.avanzar(0.1);

  expect(interfaz.hayFranjasDeCine).toBe(true);
  expect(interfaz.hayBotonDeSaltar).toBe(true);
  expect(avisosDeCinematicas).toEqual(['inicio intro']);
  expect(escenario.personajes.get('mama')?.posicion).toEqual({ x: 9, y: 2 });
});

test('los pasos de la cinemática ocurren uno tras otro, y al terminar se marca como vista', async () => {
  const { nivelEnJuego, escenario, interfaz, reloj, avisosDeCinematicas } = await empezar(
    salaCon({ intro: crearCinematica('intro', {}) }),
  );

  await reloj.avanzar(0.1);
  await reloj.avanzar(1);
  expect(escenario.personajes.get('mama')?.posicion).toEqual({ x: 7, y: 2 });
  await reloj.avanzar(1);
  expect(interfaz.globo?.texto).toBe('¿Me traes tortillas, mijo?');

  interfaz.simularToqueParaSeguir();
  await reloj.avanzar(0);

  expect(interfaz.hayFranjasDeCine).toBe(false);
  expect(avisosDeCinematicas).toEqual(['inicio intro', 'fin intro']);
  expect(nivelEnJuego.leerVariables()).toEqual({ saludo: true, 'vista.intro': true });
});

test('durante una cinemática, ni el teclado ni los toques mueven al jugador', async () => {
  const { escenario, controles, reloj } = await empezar(salaCon({ intro: crearCinematica('intro', {}) }));

  controles.direccion = { x: 1, y: 0 };
  await reloj.avanzar(0.5);
  escenario.simularToque({ tipo: 'piso', punto: { x: 8, y: 3 } });
  await reloj.avanzar(0.5);

  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 2, y: 3 });
});

test('una cinemática que ya se vio no vuelve a empezar', async () => {
  const { interfaz, reloj, avisosDeCinematicas } = await empezar(salaCon({ intro: crearCinematica('intro', {}) }), {
    variablesGuardadas: { 'vista.intro': true },
  });

  await reloj.avanzar(0.1);

  expect(interfaz.hayFranjasDeCine).toBe(false);
  expect(avisosDeCinematicas).toEqual([]);
});

test('al saltar una cinemática, cada personaje queda en su posición final y el estado queda cambiado', async () => {
  const { nivelEnJuego, escenario, interfaz, reloj } = await empezar(salaCon({ intro: crearCinematica('intro', {}) }));
  await reloj.avanzar(0.1);
  await reloj.avanzar(0.5);

  interfaz.simularToqueEnSaltar();
  await reloj.avanzar(0);

  expect(escenario.personajes.get('mama')?.posicion).toEqual({ x: 5, y: 2 });
  expect(interfaz.globosMostrados).toEqual([]);
  expect(interfaz.hayFranjasDeCine).toBe(false);
  expect(nivelEnJuego.leerVariables()).toEqual({ saludo: true, 'vista.intro': true });
});

test('interrumpir desde el host también salta la cinemática en curso', async () => {
  const { nivelEnJuego, escenario, reloj } = await empezar(salaCon({ intro: crearCinematica('intro', {}) }));
  await reloj.avanzar(0.1);

  nivelEnJuego.interrumpir();
  await reloj.avanzar(0);

  expect(escenario.personajes.get('mama')?.posicion).toEqual({ x: 5, y: 2 });
  expect(nivelEnJuego.leerVariables()).toEqual({ saludo: true, 'vista.intro': true });
});

test('una cinemática que no se puede saltar no muestra el botón de saltar', async () => {
  const { interfaz, reloj } = await empezar(salaCon({ intro: crearCinematica('intro', { saltable: false }) }));

  await reloj.avanzar(0.1);

  expect(interfaz.hayFranjasDeCine).toBe(true);
  expect(interfaz.hayBotonDeSaltar).toBe(false);
});

test('entrar a una zona empieza su cinemática, y el jugador deja de caminar', async () => {
  const cinematicas = { llegada: crearCinematica('llegada', { inicio: { tipo: 'zona', zona: 'entrada' } }) };
  const { escenario, interfaz, reloj, avisosDeCinematicas } = await empezar(salaCon(cinematicas));

  escenario.simularToque({ tipo: 'piso', punto: { x: 9, y: 3 } });
  await reloj.avanzar(1);
  expect(avisosDeCinematicas).toEqual([]);

  // A los 2.5 segundos Tommy cruza x = 7 y entra a la zona; en el cuadro siguiente empieza la cinemática.
  await reloj.avanzar(1.6);
  await reloj.avanzar(0.1);
  const dondeSeDetuvo = escenario.personajes.get('tommy')?.posicion;
  await reloj.avanzar(0.5);

  expect(avisosDeCinematicas).toEqual(['inicio llegada']);
  expect(interfaz.hayFranjasDeCine).toBe(true);
  expect(escenario.personajes.get('tommy')?.posicion).toEqual(dondeSeDetuvo);
});

test('cumplir un objetivo empieza su cinemática', async () => {
  const pasos: Paso[] = [{ tipo: 'linea', hablante: 'mama', texto: '¡Gracias, mijo!' }];
  const cinematicas = {
    gracias: crearCinematica('gracias', { inicio: { tipo: 'objetivo', objetivo: 'tortillas' }, guion: { tipo: 'pasos', pasos } }),
    entrega: crearCinematica('entrega', {
      inicio: { tipo: 'manual' },
      guion: { tipo: 'pasos', pasos: [{ tipo: 'pon', valores: { tortillas: true } }] },
    }),
  };
  const { nivelEnJuego, interfaz, reloj, avisosDeCinematicas } = await empezar(salaCon(cinematicas));
  await reloj.avanzar(0.1);
  expect(avisosDeCinematicas).toEqual([]);

  // La cinemática "entrega" cumple el objetivo; al terminar ella, empieza la de las gracias.
  void nivelEnJuego.reproducirCinematica('entrega');
  await reloj.avanzar(0.1);
  await reloj.avanzar(0.1);
  await reloj.avanzar(0.1);

  expect(avisosDeCinematicas).toEqual(['inicio entrega', 'fin entrega', 'inicio gracias']);
  expect(interfaz.globo?.texto).toBe('¡Gracias, mijo!');
});

test('si el objetivo ya venía cumplido en la partida y su cinemática no se había visto, empieza al entrar', async () => {
  const pasos: Paso[] = [{ tipo: 'linea', hablante: 'mama', texto: '¡Gracias, mijo!' }];
  const cinematicas = {
    gracias: crearCinematica('gracias', { inicio: { tipo: 'objetivo', objetivo: 'tortillas' }, guion: { tipo: 'pasos', pasos } }),
  };
  const { reloj, avisosDeCinematicas } = await empezar(salaCon(cinematicas), { variablesGuardadas: { tortillas: true } });

  await reloj.avanzar(0.1);
  await reloj.avanzar(0.1);

  expect(avisosDeCinematicas).toEqual(['inicio gracias']);
});

test('un paso "sale" avisa del destino cuando la cinemática termina, ya marcada como vista', async () => {
  const pasos: Paso[] = [
    { tipo: 'sale', destino: 'barrio' },
    { tipo: 'pon', valores: { saludo: true } },
  ];
  const cinematicas = { intro: crearCinematica('intro', { guion: { tipo: 'pasos', pasos } }) };
  const { nivelEnJuego, reloj, salidas } = await empezar(salaCon(cinematicas));

  await reloj.avanzar(0.1);
  await reloj.avanzar(0);

  expect(salidas).toEqual(['barrio']);
  // Lo que seguía a "sale" todavía se ejecutó: la salida ocurre al terminar la escena.
  expect(nivelEnJuego.leerVariables()).toEqual({ saludo: true, 'vista.intro': true });
});

test('el host puede reproducir una cinemática aunque ya se haya visto, y la promesa termina con ella', async () => {
  const cinematicas = { intro: crearCinematica('intro', { inicio: { tipo: 'manual' } }) };
  const { nivelEnJuego, interfaz, reloj, avisosDeCinematicas } = await empezar(salaCon(cinematicas), {
    variablesGuardadas: { 'vista.intro': true },
  });
  let termino = false;

  void nivelEnJuego.reproducirCinematica('intro').then(() => {
    termino = true;
  });
  await reloj.avanzar(0.1);
  expect(avisosDeCinematicas).toEqual(['inicio intro']);
  expect(termino).toBe(false);

  interfaz.simularToqueEnSaltar();
  await reloj.avanzar(0);
  expect(termino).toBe(true);
});

test('pedir una cinemática que el nivel no tiene rechaza diciendo cuál', async () => {
  const { nivelEnJuego } = await empezar(salaCon({}));

  const pedido = nivelEnJuego.reproducirCinematica('creditos');

  await expect(pedido).rejects.toEqual(
    new ErrorDeEscenario(['el nivel "casa" no tiene una cinemática llamada "creditos"']),
  );
});

test('si el nivel termina a media cinemática, no se marca como vista: al volver empieza de nuevo', async () => {
  const { nivelEnJuego, reloj } = await empezar(salaCon({ intro: crearCinematica('intro', {}) }));
  await reloj.avanzar(0.1);
  await reloj.avanzar(0.5);

  nivelEnJuego.terminar();
  await reloj.avanzar(0);

  expect(nivelEnJuego.leerVariables()).toEqual({});
});

test('al terminar una escena, la cámara vuelve al jugador y la pantalla se aclara', async () => {
  const pasos: Paso[] = [
    { tipo: 'camara', destino: 'plano_puerta', duracionEnSegundos: 0 },
    { tipo: 'fundido', sentido: 'cerrar', duracionEnSegundos: 0 },
  ];
  const cinematicas = { intro: crearCinematica('intro', { guion: { tipo: 'pasos', pasos } }) };
  const { escenario, interfaz, reloj } = await empezar(salaCon(cinematicas));

  await reloj.avanzar(0.1);
  await reloj.avanzar(0);
  expect(interfaz.opacidadDelFundido).toBe(0);

  // La cámara regresa al jugador con un viaje corto.
  await reloj.avanzar(1);
  expect(escenario.puntoEnfocado).toEqual({ x: 2, y: 3 });
});

test('varias cinemáticas en espera se reproducen en orden, una tras otra', async () => {
  const cinematicas = {
    primera: crearCinematica('primera', { guion: { tipo: 'pasos', pasos: [{ tipo: 'espera', esperaEnSegundos: 1 }] } }),
    segunda: crearCinematica('segunda', { guion: { tipo: 'pasos', pasos: [{ tipo: 'espera', esperaEnSegundos: 1 }] } }),
  };
  const { reloj, avisosDeCinematicas } = await empezar(salaCon(cinematicas));

  await reloj.avanzar(0.1);
  await reloj.avanzar(1);
  await reloj.avanzar(0.1);
  await reloj.avanzar(1);

  expect(avisosDeCinematicas).toEqual(['inicio primera', 'fin primera', 'inicio segunda', 'fin segunda']);
});

test('una cinemática en código usa los mismos pasos y se salta igual', async () => {
  const intro: CinematicaEnCodigo = async (escena) => {
    await escena.aparece('mama', 'puerta');
    await escena.camina('mama', 'sillon');
    await escena.dice('mama', '¿Me traes tortillas, mijo?');
    escena.estado.pon('saludo', true);
  };
  const cinematicas = { intro: crearCinematica('intro', { guion: { tipo: 'codigo', nombre: 'intro' } }) };
  const { nivelEnJuego, escenario, interfaz, reloj } = await empezar(salaCon(cinematicas), {
    cinematicasEnCodigo: { intro },
  });

  await reloj.avanzar(0.1);
  await reloj.avanzar(1);
  expect(escenario.personajes.get('mama')?.posicion).toEqual({ x: 7, y: 2 });

  interfaz.simularToqueEnSaltar();
  await reloj.avanzar(0);

  expect(escenario.personajes.get('mama')?.posicion).toEqual({ x: 5, y: 2 });
  expect(interfaz.globosMostrados).toEqual([]);
  expect(nivelEnJuego.leerVariables()).toEqual({ saludo: true, 'vista.intro': true });
});

test('si una cinemática en código nombra algo que no existe, falla diciendo qué llamada fue y el juego sigue', async () => {
  const intro: CinematicaEnCodigo = async (escena) => {
    await escena.camina('mama', 'cocina');
  };
  const cinematicas = { intro: crearCinematica('intro', { guion: { tipo: 'codigo', nombre: 'intro' } }) };
  const { escenario, interfaz, controles, reloj, fallas, avisosDeCinematicas } = await empezar(salaCon(cinematicas), {
    cinematicasEnCodigo: { intro },
  });

  await reloj.avanzar(0.1);
  await reloj.avanzar(0);

  expect(fallas).toEqual([
    new Error(
      '[escenario-engine] cinemática en código "intro": escena.camina("mama", "cocina"): ' +
        'no hay un punto llamado "cocina" en el mapa',
    ),
  ]);
  expect(interfaz.hayFranjasDeCine).toBe(false);
  expect(avisosDeCinematicas).toEqual(['inicio intro', 'fin intro']);

  // El jugador recupera el control.
  controles.direccion = { x: 1, y: 0 };
  await reloj.avanzar(0.5);
  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 3, y: 3 });
});

test('si avisar del inicio de una cinemática falla, no se quedan las franjas puestas y el jugador recupera el control', async () => {
  const { escenario, interfaz, controles, reloj, fallas } = await empezar(salaCon({ intro: crearCinematica('intro', {}) }), {
    fallaAlAvisarDelInicio: true,
  });

  await reloj.avanzar(0.1);
  await reloj.avanzar(0);

  expect(fallas).toEqual([new Error('falló quien escuchaba el inicio')]);
  expect(interfaz.hayFranjasDeCine).toBe(false);
  controles.direccion = { x: 1, y: 0 };
  await reloj.avanzar(0.5);
  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 3, y: 3 });
});

test('entre dos cinemáticas seguidas la pantalla se queda como la dejó la primera: no hay un destello', async () => {
  const cinematicas = {
    primera: crearCinematica('primera', {
      guion: { tipo: 'pasos', pasos: [{ tipo: 'fundido', sentido: 'cerrar', duracionEnSegundos: 0 }] },
    }),
    segunda: crearCinematica('segunda', { guion: { tipo: 'pasos', pasos: [{ tipo: 'espera', esperaEnSegundos: 1 }] } }),
  };
  const { interfaz, reloj, avisosDeCinematicas } = await empezar(salaCon(cinematicas));

  // La primera cierra a negro y termina; la segunda todavía espera su turno.
  await reloj.avanzar(0.1);
  expect(avisosDeCinematicas).toEqual(['inicio primera', 'fin primera']);
  expect(interfaz.opacidadDelFundido).toBe(1);

  // Al terminar la segunda, que es la última, la pantalla se aclara.
  await reloj.avanzar(0.1);
  await reloj.avanzar(1);
  expect(avisosDeCinematicas).toEqual(['inicio primera', 'fin primera', 'inicio segunda', 'fin segunda']);
  expect(interfaz.opacidadDelFundido).toBe(0);
});

test('los pasos de una cinemática en código se pueden separar de `escena` y siguen funcionando', async () => {
  const intro: CinematicaEnCodigo = async ({ aparece, camina, estado }) => {
    await aparece('mama', 'puerta');
    await camina('mama', 'sillon');
    estado.pon('saludo', true);
  };
  const cinematicas = { intro: crearCinematica('intro', { guion: { tipo: 'codigo', nombre: 'intro' } }) };
  const { nivelEnJuego, escenario, reloj, fallas } = await empezar(salaCon(cinematicas), {
    cinematicasEnCodigo: { intro },
  });

  await reloj.avanzar(0.1);
  await reloj.avanzar(2);
  await reloj.avanzar(0);

  expect(fallas).toEqual([]);
  expect(escenario.personajes.get('mama')?.posicion).toEqual({ x: 5, y: 2 });
  expect(nivelEnJuego.leerVariables()).toEqual({ saludo: true, 'vista.intro': true });
});

test('una línea dicha desde código puede llevar traducción y enseñar una palabra, igual que en el nivel', async () => {
  const intro: CinematicaEnCodigo = async (escena) => {
    await escena.dice('tommy', 'Bread!', { trad: '¡Pan!', en: 'bread', es: 'pan' });
  };
  const cinematicas = { intro: crearCinematica('intro', { guion: { tipo: 'codigo', nombre: 'intro' } }) };
  const { interfaz, reloj, palabras } = await empezar(salaCon(cinematicas), { cinematicasEnCodigo: { intro } });

  await reloj.avanzar(0.1);

  expect(interfaz.globosMostrados).toEqual([
    { texto: 'Bread!', traduccion: '¡Pan!', palabra: { en: 'bread', es: 'pan' } },
  ]);
  expect(palabras).toEqual([{ en: 'bread', es: 'pan' }]);
});

test('una línea desde código con solo la mitad de la palabra falla diciendo que "en" y "es" van juntos', async () => {
  const intro: CinematicaEnCodigo = async (escena) => {
    await escena.dice('tommy', 'Bread!', { en: 'bread' });
  };
  const cinematicas = { intro: crearCinematica('intro', { guion: { tipo: 'codigo', nombre: 'intro' } }) };
  const { reloj, fallas } = await empezar(salaCon(cinematicas), { cinematicasEnCodigo: { intro } });

  await reloj.avanzar(0.1);
  await reloj.avanzar(0);

  expect(fallas).toEqual([
    new Error(
      '[escenario-engine] cinemática en código "intro": escena.dice("tommy", …): ' +
        'una tarjeta de vocabulario necesita "en" y "es" juntos',
    ),
  ]);
});

test('un video con voces se nombra desde código con uno por idioma, y se ve el del idioma del sitio', async () => {
  const intro: CinematicaEnCodigo = async (escena) => {
    await escena.video({ es: 'intro_es', en: 'intro_en' });
  };
  const cinematicas = { intro: crearCinematica('intro', { guion: { tipo: 'codigo', nombre: 'intro' } }) };
  const salaConVideos: Nivel = {
    ...salaCon(cinematicas),
    assets: {
      ...SALA.assets,
      intro_es: { carpeta: '.', asset: { tipo: 'video', archivo: 'video/intro_es.mp4' } },
      intro_en: { carpeta: '.', asset: { tipo: 'video', archivo: 'video/intro_en.mp4' } },
    },
  };
  const { video, reloj } = await empezar(salaConVideos, { cinematicasEnCodigo: { intro } });

  await reloj.avanzar(0.1);

  expect(video.videosPedidos).toEqual(['/niveles/casa/video/intro_es.mp4']);
});

test('un video mal nombrado desde código falla diciendo cómo se escribe', async () => {
  const intro: CinematicaEnCodigo = async (escena) => {
    // Así llega una llamada mal hecha desde JavaScript sin tipos: falta el video en inglés.
    const soloEnEspanol: unknown = { es: 'intro_es' };
    await Reflect.apply(escena.video, undefined, [soloEnEspanol]);
  };
  const cinematicas = { intro: crearCinematica('intro', { guion: { tipo: 'codigo', nombre: 'intro' } }) };
  const { reloj, fallas } = await empezar(salaCon(cinematicas), { cinematicasEnCodigo: { intro } });

  await reloj.avanzar(0.1);
  await reloj.avanzar(0);

  expect(fallas).toEqual([
    new Error(
      '[escenario-engine] cinemática en código "intro": escena.video(…): ' +
        'se espera la clave del video, o una por idioma: { es: "…", en: "…" }',
    ),
  ]);
});

test('la escena que recibe el código del host solo trae sus pasos, `estado` y `senal`: nada interno', async () => {
  let loQueTrae: string[] = [];
  let metodosHeredados: string[] = [];
  const intro: CinematicaEnCodigo = async (escena) => {
    loQueTrae = Object.keys(escena).sort();
    metodosHeredados = Object.getOwnPropertyNames(Object.getPrototypeOf(escena));
  };
  const cinematicas = { intro: crearCinematica('intro', { guion: { tipo: 'codigo', nombre: 'intro' } }) };
  const { reloj } = await empezar(salaCon(cinematicas), { cinematicasEnCodigo: { intro } });

  await reloj.avanzar(0.1);

  expect(loQueTrae).toEqual([
    'anima',
    'aparece',
    'camara',
    'camina',
    'desaparece',
    'dice',
    'efecto',
    'espera',
    'estado',
    'fundido',
    'juntos',
    'mira',
    'musica',
    'sale',
    'secuencia',
    'senal',
    'sonido',
    'video',
  ]);
  expect(metodosHeredados).toEqual(['constructor']);
});

test('una línea desde código acepta que las opciones lleguen en null, como pasa en JavaScript', async () => {
  const intro: CinematicaEnCodigo = async (escena) => {
    const sinOpciones: unknown = null;
    await Reflect.apply(escena.dice, undefined, ['tommy', 'Hi!', sinOpciones]);
  };
  const cinematicas = { intro: crearCinematica('intro', { guion: { tipo: 'codigo', nombre: 'intro' } }) };
  const { interfaz, reloj, fallas } = await empezar(salaCon(cinematicas), { cinematicasEnCodigo: { intro } });

  await reloj.avanzar(0.1);

  expect(fallas).toEqual([]);
  expect(interfaz.globosMostrados).toEqual([{ texto: 'Hi!' }]);
});
