import { expect, test } from 'bun:test';
import { AudioDeMemoria } from '../adaptadores/memoria/audio-de-memoria.ts';
import { CargadorDeMemoria } from '../adaptadores/memoria/cargador-de-memoria.ts';
import { ControlesDeMemoria } from '../adaptadores/memoria/controles-de-memoria.ts';
import { EscenarioDeMemoria } from '../adaptadores/memoria/escenario-de-memoria.ts';
import { InterfazDeMemoria } from '../adaptadores/memoria/interfaz-de-memoria.ts';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import { leerCondicionDeTexto } from '../dominio/condicion.ts';
import { AJUSTES_DEL_MUNDO_POR_DEFECTO } from '../dominio/contenido.ts';
import type { VariablesDeEstado } from '../dominio/estado.ts';
import type { Nivel } from '../dominio/nivel.ts';
import { jugarNivel } from './jugar-nivel.ts';

/**
 * Un barrio pequeño de 10 × 4 metros. Tommy (el jugador) empieza en (2, 3) y camina a 2 metros por segundo.
 * Doña Tortu está en (6, 2): al hablarle saluda y entrega las tortillas. El comal está en (8, 1).
 * La salida está al fondo a la derecha y pide tener las tortillas.
 */
const NIVEL: Nivel = {
  descripcion: { mapa: 'mapa.tmj', contenido: 'contenido.json', assets: ['.'] },
  contenido: {
    meta: {
      id: 'barrio',
      titulo: 'El barrio',
      personajes: { tommy: { idioma: 'en', sprite: 'spr_tommy' }, tortu: { idioma: 'es', sprite: 'spr_tortu' } },
    },
    jugador: { personaje: 'tommy', velocidadEnMetrosPorSegundo: 2 },
    mundo: AJUSTES_DEL_MUNDO_POR_DEFECTO,
    estado: { objetivos: ['tortillas'], variables: [], lista: {} },
    secuencias: {},
    npcs: {
      tortu: {
        dialogo: [
          {
            pasos: [
              { tipo: 'linea', hablante: 'tortu', texto: '¡Aquí tienes!' },
              { tipo: 'pon', valores: { tortillas: true } },
            ],
          },
        ],
      },
    },
    interactivos: { comal: { dialogo: [{ pasos: [{ tipo: 'linea', hablante: 'tommy', texto: 'Hot!' }] }] } },
    comentarios: {},
    salida: {
      destino: 'Selector',
      requiere: leerCondicionDeTexto('objetivosCompletos'),
      siBloqueada: { tipo: 'pasos', pasos: [{ tipo: 'linea', hablante: 'tortu', texto: '¡Espérate!' }] },
    },
  },
  mundo: {
    anchoEnMetros: 10,
    profundidadEnMetros: 4,
    suelo: { asset: 'suelo', esquina: { x: 0, y: 0 } },
    telones: [{ descripcion: 'telón', asset: 'suelo', desde: { x: 0, y: 0 }, hasta: { x: 10, y: 0 }, altoEnMetros: 4 }],
    decorado: [
      { descripcion: 'comal', clase: 'parado', asset: 'spr_tortu', huella: { x: 7.5, y: 0.5, ancho: 1, alto: 0.5 }, alturaEnMetros: 0, id: 'comal' },
    ],
    npcs: { tortu: { descripcion: 'tortu', posicion: { x: 6, y: 2 }, mira: 'izquierda' } },
    iniciosDelJugador: [{ descripcion: 'inicio', posicion: { x: 2, y: 3 }, mira: 'derecha' }],
    puntos: {},
    salida: { descripcion: 'salida', forma: { tipo: 'rectangulo', rectangulo: { x: 9, y: 3, ancho: 1, alto: 1 } } },
    zonas: {},
    pisos: [[{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 4 }, { x: 0, y: 4 }]],
  },
  assets: {
    suelo: { carpeta: '.', asset: { tipo: 'imagen', archivo: 'img/suelo.svg', anchoEnPixeles: 1000, altoEnPixeles: 400 } },
    spr_tommy: { carpeta: '../comun', asset: { tipo: 'imagen', archivo: 'img/spr_tommy.svg', anchoEnPixeles: 90, altoEnPixeles: 160 } },
    spr_tortu: { carpeta: '.', asset: { tipo: 'imagen', archivo: 'img/spr_tortu.svg', anchoEnPixeles: 110, altoEnPixeles: 170 } },
  },
};

/** Pone a jugar un nivel con adaptadores falsos y anota en listas todo lo que el nivel avisa. */
async function empezar(nivel: Nivel, variablesGuardadas?: VariablesDeEstado) {
  const escenario = new EscenarioDeMemoria();
  const interfaz = new InterfazDeMemoria();
  const audio = new AudioDeMemoria();
  const controles = new ControlesDeMemoria();
  const reloj = new RelojDeMemoria();
  const objetivosCumplidos: string[] = [];
  const salidas: string[] = [];
  const fallas: unknown[] = [];

  const ubicacion = { direccionDelNivel: '/niveles/barrio/nivel.json', cargador: new CargadorDeMemoria({}) };
  const nivelEnJuego = await jugarNivel(
    { nivel, ubicacion, idiomaBase: 'es', minijuegos: {}, variablesGuardadas },
    { escenario, interfaz, audio, controles, reloj, azar: () => 0 },
    {
      alCumplirObjetivo: (objetivo) => objetivosCumplidos.push(objetivo),
      alVerPalabra: () => {},
      alSalir: (destino) => salidas.push(destino),
      alFallar: (error) => fallas.push(error),
    },
  );
  return { nivelEnJuego, escenario, interfaz, audio, controles, reloj, objetivosCumplidos, salidas, fallas };
}

test('al empezar, monta la escenografía con la dirección y el tamaño en metros de cada imagen', async () => {
  const { escenario } = await empezar(NIVEL);

  expect(escenario.escenografia?.suelo).toEqual({
    esquina: { x: 0, y: 0 },
    imagen: {
      direcciones: ['/niveles/barrio/img/suelo.svg'],
      cuadrosPorSegundo: 0,
      anchoEnPixeles: 1000,
      altoEnPixeles: 400,
      anchoEnMetros: 10,
      altoEnMetros: 4,
    },
  });
  expect(escenario.escenografia?.telones).toHaveLength(1);
  expect(escenario.escenografia?.decorado[0]?.huella).toEqual({ x: 7.5, y: 0.5, ancho: 1, alto: 0.5 });
});

test('pone en el escenario a los NPCs del mapa y al jugador en su inicio', async () => {
  const { escenario } = await empezar(NIVEL);

  expect(escenario.personajes.get('tortu')).toEqual({ posicion: { x: 6, y: 2 }, mira: 'izquierda', sePuedeTocar: true });
  expect(escenario.personajes.get('tommy')).toEqual({ posicion: { x: 2, y: 3 }, mira: 'derecha', sePuedeTocar: false });
});

test('tocar el piso hace caminar al jugador hacia ahí, cuadro tras cuadro', async () => {
  const { escenario, reloj } = await empezar(NIVEL);

  escenario.simularToque({ tipo: 'piso', punto: { x: 4, y: 3 } });
  await reloj.avanzar(0.5);

  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 3, y: 3 });
  await reloj.avanzar(0.5);
  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 4, y: 3 });
});

test('cada cuadro se dibuja, aunque nadie se mueva', async () => {
  const { escenario, reloj } = await empezar(NIVEL);

  await reloj.avanzar(0.016);
  await reloj.avanzar(0.016);

  expect(escenario.cuadrosDibujados).toBe(2);
});

test('al tocar a un personaje, el jugador camina hasta quedar junto a él y entonces empieza el diálogo', async () => {
  const { escenario, interfaz, reloj } = await empezar(NIVEL);

  escenario.simularToque({ tipo: 'personaje', id: 'tortu' });
  await reloj.avanzar(0.5);
  expect(interfaz.globo).toBeUndefined();
  await reloj.avanzar(3);

  // Tommy venía de la izquierda: se para 0.9 m a la izquierda de Doña Tortu y un pasito al frente.
  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 5.1, y: 2.1 });
  expect(interfaz.globo?.texto).toBe('¡Aquí tienes!');
});

test('mientras hay un diálogo, tocar el escenario no mueve al jugador', async () => {
  const { escenario, reloj } = await empezar(NIVEL);
  escenario.simularToque({ tipo: 'personaje', id: 'tortu' });
  await reloj.avanzar(3);

  escenario.simularToque({ tipo: 'piso', punto: { x: 1, y: 1 } });
  await reloj.avanzar(1);

  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 5.1, y: 2.1 });
});

test('cuando un diálogo cumple un objetivo, el nivel avisa y la variable queda en el estado', async () => {
  const { nivelEnJuego, escenario, interfaz, reloj, objetivosCumplidos } = await empezar(NIVEL);

  escenario.simularToque({ tipo: 'personaje', id: 'tortu' });
  await reloj.avanzar(3);
  interfaz.simularToqueParaSeguir();
  await reloj.avanzar(0.1);

  expect(objetivosCumplidos).toEqual(['tortillas']);
  expect(nivelEnJuego.leerVariables()).toEqual({ 'charlas.tortu': true, tortillas: true });
});

test('al tocar un objeto interactivo, el jugador camina hasta quedar frente a él y lo usa', async () => {
  const { escenario, interfaz, reloj } = await empezar(NIVEL);

  escenario.simularToque({ tipo: 'decorado', id: 'comal' });
  await reloj.avanzar(5);

  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 8, y: 1.3 });
  expect(interfaz.globo?.texto).toBe('Hot!');
});

test('al llegar a la salida sin cumplir lo que pide, se ejecutan los pasos de la salida bloqueada', async () => {
  const { escenario, interfaz, reloj, salidas } = await empezar(NIVEL);

  escenario.simularToque({ tipo: 'piso', punto: { x: 9.5, y: 3.5 } });
  await reloj.avanzar(5);

  expect(salidas).toEqual([]);
  expect(interfaz.globo?.texto).toBe('¡Espérate!');
});

test('al llegar a la salida con todo cumplido, el nivel avisa del destino', async () => {
  const { escenario, reloj, salidas } = await empezar(NIVEL, { tortillas: true });

  escenario.simularToque({ tipo: 'piso', punto: { x: 9.5, y: 3.5 } });
  await reloj.avanzar(5);

  expect(salidas).toEqual(['Selector']);
});

test('las variables guardadas se restauran al empezar', async () => {
  const { nivelEnJuego } = await empezar(NIVEL, { tortillas: true, 'charlas.tortu': true });

  expect(nivelEnJuego.leerVariables()).toEqual({ tortillas: true, 'charlas.tortu': true });
});

test('interrumpir cierra el diálogo en curso', async () => {
  const { nivelEnJuego, escenario, interfaz, reloj } = await empezar(NIVEL);
  escenario.simularToque({ tipo: 'personaje', id: 'tortu' });
  await reloj.avanzar(3);

  nivelEnJuego.interrumpir();
  await reloj.avanzar(0.1);

  expect(interfaz.globo).toBeUndefined();
});

test('al terminar, deja de atender toques y de dibujar', async () => {
  const { nivelEnJuego, escenario, reloj } = await empezar(NIVEL);

  nivelEnJuego.terminar();
  escenario.simularToque({ tipo: 'piso', punto: { x: 4, y: 3 } });
  await reloj.avanzar(0.5);

  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 2, y: 3 });
  expect(escenario.cuadrosDibujados).toBe(0);
});

test('en un nivel sin jugador, la cámara mira al centro del lugar y se puede hablar sin caminar', async () => {
  const nivelSinJugador: Nivel = {
    ...NIVEL,
    contenido: { ...NIVEL.contenido, jugador: undefined },
    mundo: { ...NIVEL.mundo, iniciosDelJugador: [] },
  };
  const { escenario, interfaz, reloj } = await empezar(nivelSinJugador);

  escenario.simularToque({ tipo: 'personaje', id: 'tortu' });
  await reloj.avanzar(0.1);

  expect(escenario.puntoEnfocado).toEqual({ x: 5, y: 2 });
  expect(escenario.personajes.has('tommy')).toBe(false);
  expect(interfaz.globo?.texto).toBe('¡Aquí tienes!');
});

test('con una dirección oprimida en el teclado, el jugador camina hacia ese lado mientras se oprime', async () => {
  const { escenario, controles, reloj } = await empezar(NIVEL);

  controles.direccion = { x: 1, y: 0 };
  await reloj.avanzar(0.5);
  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 3, y: 3 });

  controles.direccion = { x: 0, y: 0 };
  await reloj.avanzar(0.5);
  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 3, y: 3 });
});

test('durante un diálogo, el teclado no mueve al jugador', async () => {
  const { escenario, controles, reloj } = await empezar(NIVEL);
  escenario.simularToque({ tipo: 'personaje', id: 'tortu' });
  await reloj.avanzar(3);

  controles.direccion = { x: -1, y: 0 };
  await reloj.avanzar(1);

  expect(escenario.personajes.get('tommy')?.posicion).toEqual({ x: 5.1, y: 2.1 });
});

test('al entrar a una zona con grupo, el jugador comenta sin dejar de poder caminar', async () => {
  const nivelConZona: Nivel = {
    ...NIVEL,
    contenido: {
      ...NIVEL.contenido,
      comentarios: { general: [{ tipo: 'linea', hablante: 'tommy', texto: 'Wow!', traduccion: '¡Qué colorido!' }] },
    },
    mundo: {
      ...NIVEL.mundo,
      zonas: {
        plaza: {
          descripcion: 'plaza',
          forma: { tipo: 'rectangulo', rectangulo: { x: 3, y: 2, ancho: 2, alto: 2 } },
          grupo: 'general',
          esperaEnSegundos: 20,
        },
      },
    },
  };
  const { escenario, interfaz, reloj } = await empezar(nivelConZona);

  escenario.simularToque({ tipo: 'piso', punto: { x: 4, y: 3 } });
  await reloj.avanzar(0.6);

  expect(interfaz.globo).toEqual({ texto: 'Wow!', traduccion: '¡Qué colorido!', palabra: undefined });
  // El globo de un comentario no atrapa toques: el jugador puede seguir caminando.
  expect(interfaz.hayQuienEscuchaToques).toBe(false);
});

test('un diálogo que empieza reemplaza el comentario, y el comentario no le borra su globo', async () => {
  const nivelConZona: Nivel = {
    ...NIVEL,
    contenido: { ...NIVEL.contenido, comentarios: { general: [{ tipo: 'linea', hablante: 'tommy', texto: 'Wow!' }] } },
    mundo: {
      ...NIVEL.mundo,
      zonas: {
        todo: {
          descripcion: 'todo',
          forma: { tipo: 'rectangulo', rectangulo: { x: 0, y: 0, ancho: 10, alto: 4 } },
          grupo: 'general',
          esperaEnSegundos: 20,
        },
      },
    },
  };
  const { escenario, interfaz, reloj } = await empezar(nivelConZona);
  await reloj.avanzar(0.016);
  expect(interfaz.globo?.texto).toBe('Wow!');

  escenario.simularToque({ tipo: 'personaje', id: 'tortu' });
  await reloj.avanzar(3);

  expect(interfaz.globo?.texto).toBe('¡Aquí tienes!');
});
