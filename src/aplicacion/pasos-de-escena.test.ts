// Comprueba que los pasos de escena (animar, aparecer, voltear, cámara, fundido, música, video) se vean
// y se oigan en un nivel de verdad: aquí se ejecutan dentro de una cinemática de entrada.

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
import type { Idioma } from '../dominio/idioma.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { Paso } from '../dominio/paso.ts';
import { jugarNivel } from './jugar-nivel.ts';

/**
 * Una sala de 10 × 4 metros. Tommy (el jugador) empieza en (2, 3) mirando a la derecha y mamá está en (6, 2).
 * La animación "tommy_saluda" tiene 4 cuadros a 4 por segundo: dura 1 segundo.
 */
const SALA: Nivel = {
  descripcion: { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.'] },
  contenido: {
    meta: {
      id: 'casa',
      titulo: 'La casa',
      personajes: {
        tommy: { idioma: 'en', sprite: 'spr_tommy' },
        mama: { idioma: 'es', sprite: 'spr_mama' },
        abuela: { idioma: 'es', sprite: 'spr_abuela' },
      },
    },
    jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2 },
    mundo: {
      ...AJUSTES_DEL_MUNDO_POR_DEFECTO,
      planos: { plano_puerta: { mira: 'puerta', distanciaEnMetros: 4, alturaEnMetros: 2, giroEnGrados: 0 } },
    },
    estado: { objetivos: [], variables: [], lista: {} },
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
    npcs: { mama: { descripcion: 'mamá', posicion: { x: 6, y: 2 }, mira: 'derecha' } },
    iniciosDelJugador: [{ descripcion: 'inicio', posicion: { x: 2, y: 3 }, mira: 'derecha' }],
    puntos: { puerta: { x: 9, y: 2 }, ventana: { x: 1, y: 1 } },
    zonas: {},
    pisos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }]],
  },
  assets: {
    spr_tommy: { carpeta: '.', asset: { tipo: 'imagen', archivo: 'img/spr_tommy.svg', anchoEnPixeles: 90, altoEnPixeles: 160 } },
    spr_mama: { carpeta: '.', asset: { tipo: 'imagen', archivo: 'img/spr_mama.svg', anchoEnPixeles: 110, altoEnPixeles: 170 } },
    spr_abuela: { carpeta: '.', asset: { tipo: 'imagen', archivo: 'img/spr_abuela.svg', anchoEnPixeles: 100, altoEnPixeles: 150 } },
    tommy_saluda: {
      carpeta: '.',
      asset: {
        tipo: 'animacion',
        cuadros: ['img/tommy_saluda_1.svg', 'img/tommy_saluda_2.svg', 'img/tommy_saluda_3.svg', 'img/tommy_saluda_4.svg'],
        cuadrosPorSegundo: 4,
        anchoEnPixeles: 90,
        altoEnPixeles: 160,
      },
    },
    mus_casa: { carpeta: '.', asset: { tipo: 'audio', archivo: 'audio/mus_casa.mp3' } },
    puerta_abre: { carpeta: '.', asset: { tipo: 'audio', archivo: 'audio/puerta_abre.mp3' } },
    intro_es: { carpeta: '.', asset: { tipo: 'video', archivo: 'video/intro_es.mp4' } },
    intro_en: { carpeta: '.', asset: { tipo: 'video', archivo: 'video/intro_en.mp4' } },
  },
};

/**
 * Pone a jugar la sala con una cinemática de entrada hecha con esos pasos y avanza el primer cuadro,
 * que es cuando la cinemática empieza: al volver, ya pasó 0.1 segundos de su primer paso.
 */
async function empezarConPasos(pasos: readonly Paso[], idiomaBase: Idioma = 'es') {
  const nivel: Nivel = {
    ...SALA,
    contenido: {
      ...SALA.contenido,
      cinematicas: {
        escena: {
          inicio: { tipo: 'alEntrar' },
          condicion: leerCondicionDeTexto('no vista.escena'),
          saltable: true,
          guion: { tipo: 'pasos', pasos },
        },
      },
    },
  };
  const escenario = new EscenarioDeMemoria();
  const interfaz = new InterfazDeMemoria();
  const audio = new AudioDeMemoria();
  const video = new VideoDeMemoria();
  const reloj = new RelojDeMemoria();

  const ubicacion = { direccionDelNivel: '/niveles/casa/nivel.json', cargador: new CargadorDeMemoria({}) };
  await jugarNivel(
    { nivel, ubicacion, idiomaBase, minijuegos: {} },
    { escenario, interfaz, audio, video, controles: new ControlesDeMemoria(), reloj, azar: () => 0 },
    {
      alCumplirObjetivo: () => {},
      alVerPalabra: () => {},
      alSalir: () => {},
      alFallar: (error) => {
        throw error;
      },
      alEmpezarCinematica: () => {},
      alTerminarCinematica: () => {},
      alEmpezarDialogo: () => {},
      alTerminarDialogo: () => {},
      alCambiarElEstado: () => {},
      alEmpezarMinijuego: () => {},
      alTerminarMinijuego: () => {},
    },
  );
  await reloj.avanzar(0.1);
  return { escenario, interfaz, audio, video, reloj };
}

test('las imágenes que usarán "anima" y "aparece" se descargan al empezar el nivel', async () => {
  const { escenario } = await empezarConPasos([
    { tipo: 'espera', esperaEnSegundos: 5 },
    { tipo: 'anima', personaje: 'tommy', clave: 'tommy_saluda', repite: false },
    { tipo: 'aparece', personaje: 'abuela', punto: 'puerta' },
  ]);

  const primerosCuadros = escenario.imagenesPrecargadas.map((imagen) => imagen.direcciones[0]);
  expect(primerosCuadros).toEqual(['/niveles/casa/img/tommy_saluda_1.svg', '/niveles/casa/img/spr_abuela.svg']);
});

test('"anima" sin repetir muestra la animación una vez, espera lo que dura y regresa al dibujo normal', async () => {
  const { escenario, interfaz, reloj } = await empezarConPasos([
    { tipo: 'anima', personaje: 'tommy', clave: 'tommy_saluda', repite: false },
    { tipo: 'linea', hablante: 'mama', texto: '¡Hola, mijo!' },
  ]);

  expect(escenario.dibujos.get('tommy')?.imagen.direcciones).toHaveLength(4);
  expect(escenario.dibujos.get('tommy')?.repite).toBe(false);
  await reloj.avanzar(0.8);
  expect(interfaz.globo).toBeUndefined();

  await reloj.avanzar(0.1);
  expect(escenario.dibujos.get('tommy')?.imagen.direcciones).toEqual(['/niveles/casa/img/spr_tommy.svg']);
  expect(interfaz.globo?.texto).toBe('¡Hola, mijo!');
});

test('"anima" con repetir deja al personaje con el dibujo nuevo y la escena sigue de inmediato', async () => {
  const { escenario, interfaz } = await empezarConPasos([
    { tipo: 'anima', personaje: 'tommy', clave: 'tommy_saluda', repite: true },
    { tipo: 'linea', hablante: 'mama', texto: '¡Hola, mijo!' },
  ]);

  expect(escenario.dibujos.get('tommy')?.repite).toBe(true);
  expect(interfaz.globo?.texto).toBe('¡Hola, mijo!');
});

test('"aparece" mete al personaje en su punto y "desaparece" lo saca', async () => {
  const { escenario, reloj } = await empezarConPasos([
    { tipo: 'aparece', personaje: 'abuela', punto: 'puerta' },
    { tipo: 'espera', esperaEnSegundos: 1 },
    { tipo: 'desaparece', personaje: 'abuela' },
  ]);

  expect(escenario.personajes.get('abuela')?.posicion).toEqual({ x: 9, y: 2 });
  // No tiene diálogo en `npcs`, así que no se puede tocar.
  expect(escenario.personajes.get('abuela')?.sePuedeTocar).toBe(false);

  await reloj.avanzar(1);
  expect(escenario.personajes.has('abuela')).toBe(false);
});

test('"aparece" con alguien que ya está en el escenario solo lo cambia de lugar', async () => {
  const { escenario } = await empezarConPasos([{ tipo: 'aparece', personaje: 'mama', punto: 'puerta' }]);

  expect(escenario.personajes.get('mama')?.posicion).toEqual({ x: 9, y: 2 });
});

test('"mira" voltea al personaje hacia otro personaje o hacia un punto del mapa', async () => {
  const { escenario } = await empezarConPasos([
    { tipo: 'mira', personaje: 'mama', hacia: 'tommy' },
    { tipo: 'mira', personaje: 'tommy', hacia: 'ventana' },
  ]);

  // Tommy está a la izquierda de mamá, y la ventana a la izquierda de Tommy.
  expect(escenario.personajes.get('mama')?.mira).toBe('izquierda');
  expect(escenario.personajes.get('tommy')?.mira).toBe('izquierda');
});

test('"musica" y "sonido" usan el archivo de su clave; una clave sin archivo no cambia nada', async () => {
  const { audio } = await empezarConPasos([
    { tipo: 'musica', clave: 'mus_casa' },
    { tipo: 'sonido', clave: 'puerta_abre' },
    { tipo: 'musica', clave: 'mus_sin_grabar' },
    { tipo: 'sonido', clave: 'sonido_sin_grabar' },
  ]);

  expect(audio.musica).toBe('/niveles/casa/audio/mus_casa.mp3');
  expect(audio.sonidosTocados).toEqual(['/niveles/casa/audio/puerta_abre.mp3']);
});

test('"video" reproduce el del idioma del sitio y la escena sigue cuando termina', async () => {
  const pasos: Paso[] = [
    { tipo: 'video', clavePorIdioma: { es: 'intro_es', en: 'intro_en' } },
    { tipo: 'linea', hablante: 'mama', texto: '¡Hola, mijo!' },
  ];
  const { video, interfaz, reloj } = await empezarConPasos(pasos, 'en');

  expect(video.videosPedidos).toEqual(['/niveles/casa/video/intro_en.mp4']);
  expect(interfaz.globo).toBeUndefined();

  video.terminarVideo();
  await reloj.avanzar(0);
  expect(interfaz.globo?.texto).toBe('¡Hola, mijo!');
});

test('"camara" con duración lleva la cámara poco a poco, y sin duración es un corte', async () => {
  const { escenario, reloj } = await empezarConPasos([
    { tipo: 'camara', destino: 'plano_puerta', duracionEnSegundos: 2 },
    { tipo: 'camara', destino: 'mama', duracionEnSegundos: 0 },
    { tipo: 'espera', esperaEnSegundos: 5 },
  ]);

  // A medio viaje (1 segundo de 2), la cámara va a la mitad entre Tommy (2, 3) y la puerta (9, 2).
  await reloj.avanzar(0.9);
  expect(escenario.puntoEnfocado).toEqual({ x: 5.5, y: 2.5 });

  // Al llegar a la puerta sigue el corte hacia mamá, que está en (6, 2).
  await reloj.avanzar(1);
  await reloj.avanzar(0);
  expect(escenario.puntoEnfocado).toEqual({ x: 6, y: 2 });
});

test('"fundido" oscurece y aclara la pantalla en el tiempo que dice', async () => {
  const { interfaz, reloj } = await empezarConPasos([
    { tipo: 'fundido', sentido: 'cerrar', duracionEnSegundos: 1 },
    { tipo: 'fundido', sentido: 'abrir', duracionEnSegundos: 1 },
    { tipo: 'espera', esperaEnSegundos: 5 },
  ]);

  await reloj.avanzar(0.4);
  expect(interfaz.opacidadDelFundido).toBe(0.5);
  await reloj.avanzar(0.5);
  expect(interfaz.opacidadDelFundido).toBe(1);
  await reloj.avanzar(0.5);
  expect(interfaz.opacidadDelFundido).toBe(0.5);
  await reloj.avanzar(0.5);
  expect(interfaz.opacidadDelFundido).toBe(0);
});
