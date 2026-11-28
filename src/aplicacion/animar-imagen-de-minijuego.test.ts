import { expect, test } from 'bun:test';
import { RelojDeMemoria } from '../adaptadores/memoria/reloj-de-memoria.ts';
import type { CuadrosDeAsset } from '../puertos/minijuego.ts';
import { animarImagenDeMinijuego, cuadroQueToca } from './animar-imagen-de-minijuego.ts';

const PARPADEO: CuadrosDeAsset = { urls: ['/abiertos.svg', '/abiertos.svg', '/cerrados.svg'], cuadrosPorSegundo: 2 };
const SIN_CUADROS: CuadrosDeAsset = { urls: [], cuadrosPorSegundo: 0 };

test('el cuadro que toca sale de los segundos y del ritmo, y al terminar vuelve a empezar', () => {
  expect(cuadroQueToca(PARPADEO, 0)).toBe('/abiertos.svg');
  expect(cuadroQueToca(PARPADEO, 0.99)).toBe('/abiertos.svg');
  expect(cuadroQueToca(PARPADEO, 1)).toBe('/cerrados.svg');
  expect(cuadroQueToca(PARPADEO, 1.5)).toBe('/abiertos.svg');
});

test('una imagen fija o una animación sin velocidad se quedan en su primer cuadro', () => {
  expect(cuadroQueToca({ urls: ['/comal.svg'], cuadrosPorSegundo: 0 }, 10)).toBe('/comal.svg');
  expect(cuadroQueToca({ urls: ['/a.svg', '/b.svg'], cuadrosPorSegundo: 0 }, 10)).toBe('/a.svg');
  expect(cuadroQueToca(SIN_CUADROS, 10)).toBeUndefined();
});

test('la imagen cambia de cuadro solo cuando pasa el tiempo del juego', async () => {
  const reloj = new RelojDeMemoria();
  const imagen = { src: '' };
  const vistos: string[] = [];

  animarImagenDeMinijuego({
    imagen,
    cuadros: PARPADEO,
    reloj,
    buscarCuadros: () => SIN_CUADROS,
    senales: [new AbortController().signal],
  });
  vistos.push(imagen.src);
  await reloj.avanzar(1);
  vistos.push(imagen.src);
  await reloj.avanzar(0.5);
  vistos.push(imagen.src);

  expect(vistos).toEqual(['/abiertos.svg', '/cerrados.svg', '/abiertos.svg']);
});

test('detener, o que se dispare cualquiera de sus señales, deja la imagen en el cuadro que mostraba', async () => {
  const reloj = new RelojDeMemoria();
  const conDetener = { src: '' };
  const conSenal = { src: '' };
  const senalDeQuienLaAnima = new AbortController();
  const pedidoBase = { cuadros: PARPADEO, reloj, buscarCuadros: () => SIN_CUADROS };

  const animacion = animarImagenDeMinijuego({ ...pedidoBase, imagen: conDetener, senales: [] });
  animarImagenDeMinijuego({
    ...pedidoBase,
    imagen: conSenal,
    senales: [new AbortController().signal, senalDeQuienLaAnima.signal],
  });
  animacion.detener();
  animacion.detener();
  senalDeQuienLaAnima.abort();
  await reloj.avanzar(1);

  expect(conDetener.src).toBe('/abiertos.svg');
  expect(conSenal.src).toBe('/abiertos.svg');
});

test('con una señal que ya se disparó, la imagen recibe su primer cuadro pero no se anima', async () => {
  const reloj = new RelojDeMemoria();
  const imagen = { src: '' };
  const yaCerrado = new AbortController();
  yaCerrado.abort();

  animarImagenDeMinijuego({
    imagen,
    cuadros: PARPADEO,
    reloj,
    buscarCuadros: () => SIN_CUADROS,
    senales: [yaCerrado.signal],
  });
  await reloj.avanzar(1);

  expect(imagen.src).toBe('/abiertos.svg');
});

test('src solo se escribe cuando cambia el cuadro, para que el navegador no vuelva a pedir la imagen', async () => {
  const reloj = new RelojDeMemoria();
  const direccionesPuestas: string[] = [];
  const imagen = {
    get src(): string {
      return direccionesPuestas.at(-1) ?? '';
    },
    set src(direccion: string) {
      direccionesPuestas.push(direccion);
    },
  };

  animarImagenDeMinijuego({ imagen, cuadros: PARPADEO, reloj, buscarCuadros: () => SIN_CUADROS, senales: [] });
  for (let i = 0; i < 6; i++) {
    await reloj.avanzar(0.25);
  }

  // Seis cuadros del juego en 1.5 s: abiertos (0 s), cerrados (1 s) y abiertos otra vez (1.5 s).
  expect(direccionesPuestas).toEqual(['/abiertos.svg', '/cerrados.svg', '/abiertos.svg']);
});
