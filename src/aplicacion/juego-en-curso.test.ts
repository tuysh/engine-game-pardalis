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
import { ErrorDeEscenario } from '../dominio/error-de-escenario.ts';
import type { Asset } from '../dominio/manifiesto.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { Partida } from '../dominio/partida.ts';
import { JuegoEnCurso } from './juego-en-curso.ts';
import { leerNivelPorJugar } from './leer-nivel-por-jugar.ts';
import type { FuenteDeNiveles } from './leer-nivel-por-jugar.ts';

const IMAGEN_DE_TOMMY: Asset = { tipo: 'imagen', archivo: 'img/spr_tommy.svg', anchoEnPixeles: 90, altoEnPixeles: 160 };

/** La casa: sin jugador. Su cinemática de entrada cumple el objetivo "despertar" y sale hacia el barrio. */
const CASA: Nivel = {
  descripcion: { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.'] },
  contenido: {
    meta: { id: 'casa', titulo: 'La casa', personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' } } },
    mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
    estado: { objetivos: ['despertar'], variables: [], lista: {} },
    secuencias: {},
    npcs: {},
    interactivos: {},
    cinematicas: {
      intro: {
        inicio: { tipo: 'alEntrar' },
        condicion: leerCondicionDeTexto('no vista.intro'),
        saltable: true,
        guion: {
          tipo: 'pasos',
          pasos: [
            { tipo: 'pon', valores: { despertar: true } },
            { tipo: 'sale', destino: 'barrio' },
          ],
        },
      },
    },
    comentarios: {},
  },
  mundo: {
    anchoEnMetros: 6,
    profundidadEnMetros: 4,
    telones: [],
    decorado: [],
    npcs: {},
    iniciosDelJugador: [],
    puntos: {},
    zonas: {},
    pisos: [[{ x: 0, y: 0 }, { x: 6, y: 0 }, { x: 6, y: 4 }, { x: 0, y: 4 }]],
  },
  assets: { spr_tommy: { carpeta: '.', asset: IMAGEN_DE_TOMMY } },
};

/**
 * El barrio: 10 × 4 metros, con Tommy como jugador en (2, 3) a 2 metros por segundo.
 * La salida está a la derecha (de x = 9 en adelante) y lleva a "Selector", que no es un nivel.
 */
const BARRIO: Nivel = {
  descripcion: { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.'] },
  contenido: {
    meta: { id: 'barrio', titulo: 'El barrio', personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' } } },
    jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2 },
    mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
    estado: { objetivos: [], variables: ['globo'], lista: {} },
    secuencias: {},
    npcs: {},
    interactivos: {},
    cinematicas: {},
    comentarios: {},
    salida: { destino: 'Selector' },
  },
  mundo: {
    anchoEnMetros: 10,
    profundidadEnMetros: 4,
    telones: [],
    decorado: [],
    npcs: {},
    iniciosDelJugador: [{ descripcion: 'inicio', posicion: { x: 2, y: 3 }, mira: 'derecha' }],
    puntos: {},
    salida: { descripcion: 'salida', forma: { tipo: 'rectangulo', rectangulo: { x: 9, y: 0, ancho: 1, alto: 4 } } },
    zonas: {},
    pisos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }]],
  },
  assets: { spr_tommy: { carpeta: '.', asset: IMAGEN_DE_TOMMY } },
};

/** Los niveles que «existen» en estas pruebas, por la dirección de su `nivel.json`. */
const NIVELES_POR_DIRECCION: Record<string, Nivel> = {
  '/niveles/casa/nivel.json': CASA,
  '/niveles/barrio/nivel.json': BARRIO,
};

const FUENTE: FuenteDeNiveles = {
  niveles: { casa: '/niveles/casa/nivel.json', barrio: '/niveles/barrio/nivel.json', roto: '/niveles/roto/nivel.json' },
  async leerNivel(direccion) {
    if (!Object.hasOwn(NIVELES_POR_DIRECCION, direccion)) {
      return { errores: [`no existe el archivo ${direccion}`], advertencias: [] };
    }
    return { errores: [], advertencias: [], nivel: NIVELES_POR_DIRECCION[direccion] };
  },
};

/** Crea el juego con adaptadores falsos, lo pone a jugar en un nivel y anota en `avisos` todo lo que avisa. */
async function empezarEn(nivel: string, partidaInicial?: Partida) {
  const escenario = new EscenarioDeMemoria();
  const reloj = new RelojDeMemoria();
  const avisos: string[] = [];
  const partidasPorGuardar: Partida[] = [];
  const fallas: ErrorDeEscenario[] = [];

  const juego = new JuegoEnCurso({
    fuente: FUENTE,
    cargador: new CargadorDeMemoria({}),
    idiomaBase: 'es',
    minijuegos: {},
    cinematicasEnCodigo: {},
    conMenosMovimiento: false,
    puertos: {
      escenario,
      interfaz: new InterfazDeMemoria(),
      audio: new AudioDeMemoria(),
      video: new VideoDeMemoria(),
      controles: new ControlesDeMemoria(),
      reloj,
      azar: () => 0,
    },
    avisos: {
      alGuardar: (partida) => partidasPorGuardar.push(partida),
      alCumplirObjetivo: (objetivo) => avisos.push(`objetivo ${objetivo}`),
      alVerPalabra: () => {},
      alCambiarDeNivel: (id, anterior) => avisos.push(`nivel ${id} (antes ${anterior})`),
      alEmpezarCinematica: (id) => avisos.push(`inicio ${id}`),
      alTerminarCinematica: (id) => avisos.push(`fin ${id}`),
      alSalir: (destino) => avisos.push(`salida ${destino}`),
      alFallar: (error) => fallas.push(error),
    },
    partidaInicial,
  });
  await juego.jugar(await leerNivelPorJugar(nivel, FUENTE));
  return { juego, escenario, reloj, avisos, partidasPorGuardar, fallas };
}

test('al empezar se juega el nivel pedido, y la partida lo nombra', async () => {
  const { juego, escenario } = await empezarEn('barrio');

  expect(juego.idDelNivel).toBe('barrio');
  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 2, y: 3 });
  expect(juego.leerPartida()).toEqual({ v: 1, nivel: 'barrio', niveles: { barrio: { estado: {} } } });
});

test('cuando un nivel sale hacia otro nivel registrado, ese nivel se carga solo y el juego avisa', async () => {
  const { juego, escenario, reloj, avisos } = await empezarEn('casa');

  // En el primer cuadro empieza la cinemática de entrada, que termina saliendo hacia el barrio.
  await reloj.avanzar(0.1);
  await reloj.avanzar(0);

  expect(juego.idDelNivel).toBe('barrio');
  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 2, y: 3 });
  expect(avisos).toEqual(['inicio intro', 'objetivo despertar', 'fin intro', 'nivel barrio (antes casa)']);
});

test('la partida conserva el estado del nivel que se dejó', async () => {
  const { juego, reloj, partidasPorGuardar } = await empezarEn('casa');

  await reloj.avanzar(0.1);
  await reloj.avanzar(0);

  const partidaEsperada: Partida = {
    v: 1,
    nivel: 'barrio',
    niveles: { casa: { estado: { despertar: true, 'vista.intro': true } }, barrio: { estado: {} } },
  };
  expect(juego.leerPartida()).toEqual(partidaEsperada);
  // La última vez que se avisó de guardar fue al terminar de cargar el barrio.
  expect(partidasPorGuardar.at(-1)).toEqual(partidaEsperada);
});

test('al volver a un nivel ya visitado se restauran sus variables', async () => {
  const partida: Partida = {
    v: 1,
    nivel: 'barrio',
    niveles: { casa: { estado: { despertar: true, 'vista.intro': true } }, barrio: { estado: { globo: 'rosa' } } },
  };
  const { juego, reloj, avisos } = await empezarEn('barrio', partida);

  await juego.cargar('casa');
  await reloj.avanzar(0.1);

  // La cinemática de entrada de la casa ya se había visto: no vuelve a empezar ni saca al jugador.
  expect(juego.idDelNivel).toBe('casa');
  expect(avisos).toEqual(['nivel casa (antes barrio)']);
  expect(juego.leerPartida().niveles).toEqual({
    casa: { estado: { despertar: true, 'vista.intro': true } },
    barrio: { estado: { globo: 'rosa' } },
  });
});

test('una salida hacia un destino que no es un nivel se le avisa al host', async () => {
  const { juego, escenario, reloj, avisos } = await empezarEn('barrio');

  escenario.simularToque({ tipo: 'piso', punto: { x: 9.5, y: 3 } });
  await reloj.avanzar(5);

  expect(avisos).toEqual(['salida Selector']);
  expect(juego.idDelNivel).toBe('barrio');
});

test('si el nivel que se pide cargar tiene errores, rechaza con ellos y se sigue jugando el que estaba', async () => {
  const { juego, escenario, reloj } = await empezarEn('barrio');

  const carga = juego.cargar('roto');

  await expect(carga).rejects.toEqual(new ErrorDeEscenario(['no existe el archivo /niveles/roto/nivel.json']));
  expect(juego.idDelNivel).toBe('barrio');
  escenario.simularToque({ tipo: 'piso', punto: { x: 4, y: 3 } });
  await reloj.avanzar(1);
  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 4, y: 3 });
});

test('un nivel que no está registrado se puede cargar por su dirección, y su id es el de su contenido', async () => {
  const { juego } = await empezarEn('/niveles/barrio/nivel.json');

  expect(juego.idDelNivel).toBe('barrio');
});

test('al terminar el juego, el nivel deja de dibujarse y ya no se puede cargar otro', async () => {
  const { juego, escenario, reloj } = await empezarEn('barrio');

  juego.terminar();
  await reloj.avanzar(0.5);

  expect(escenario.cuadrosDibujados).toBe(0);
  await expect(juego.cargar('casa')).rejects.toEqual(
    new ErrorDeEscenario(['no se cargó el nivel "casa": el juego ya se destruyó']),
  );
  // La última partida se conserva, por si el host la pide después de destruir el juego.
  expect(juego.leerPartida().nivel).toBe('barrio');
});
