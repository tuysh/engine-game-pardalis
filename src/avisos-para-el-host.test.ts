import { expect, test } from 'bun:test';
import { crearAvisosParaElHost } from './avisos-para-el-host.ts';
import { ErrorDeEscenario } from './dominio/error-de-escenario.ts';
import type { Partida } from './dominio/partida.ts';
import { EmisorDeEventos } from './emisor-de-eventos.ts';

test('cambiar de nivel llega al host como el evento "nivel", con el id nuevo y el anterior', () => {
  const emisor = new EmisorDeEventos();
  const cambios: unknown[] = [];
  emisor.on('nivel', (cambio) => cambios.push(cambio));

  crearAvisosParaElHost(emisor).alCambiarDeNivel('barrio', 'casa');

  expect(cambios).toEqual([{ id: 'barrio', anterior: 'casa' }]);
});

test('una cinemática llega como el evento "cinematica" dos veces: al empezar y al terminar', () => {
  const emisor = new EmisorDeEventos();
  const avisos: unknown[] = [];
  emisor.on('cinematica', (aviso) => avisos.push(aviso));

  const avisosDelJuego = crearAvisosParaElHost(emisor);
  avisosDelJuego.alEmpezarCinematica('intro');
  avisosDelJuego.alTerminarCinematica('intro');

  expect(avisos).toEqual([
    { id: 'intro', fase: 'inicio' },
    { id: 'intro', fase: 'fin' },
  ]);
});

test('un minijuego llega como el evento "minijuego" dos veces: al empezar y al terminar, con cómo terminó', () => {
  const emisor = new EmisorDeEventos();
  const avisos: unknown[] = [];
  emisor.on('minijuego', (aviso) => avisos.push(aviso));

  const avisosDelJuego = crearAvisosParaElHost(emisor);
  avisosDelJuego.alEmpezarMinijuego('Tortilleria');
  avisosDelJuego.alTerminarMinijuego('Tortilleria', { exito: true, cambios: { tortillas: true } });

  expect(avisos).toEqual([
    { nombre: 'Tortilleria', fase: 'inicio' },
    { nombre: 'Tortilleria', fase: 'fin', exito: true, cambios: { tortillas: true } },
  ]);
});

test('un cambio del estado llega como el evento "estado", con el nivel, lo que cambió y todas las variables', () => {
  const emisor = new EmisorDeEventos();
  const cambios: unknown[] = [];
  emisor.on('estado', (cambio) => cambios.push(cambio));

  const cambio = { nivel: 'mercado', cambios: { dinero: 90 }, variables: { dinero: 90, maiz: true } };
  crearAvisosParaElHost(emisor).alCambiarElEstado(cambio);

  expect(cambios).toEqual([cambio]);
});

test('lo demás llega tal cual con el nombre de su evento', () => {
  const emisor = new EmisorDeEventos();
  const recibido: unknown[] = [];
  emisor.on('guardar', (partida) => recibido.push(['guardar', partida]));
  emisor.on('objetivo', (objetivo) => recibido.push(['objetivo', objetivo]));
  emisor.on('palabra', (palabra) => recibido.push(['palabra', palabra]));
  emisor.on('salida', (destino) => recibido.push(['salida', destino]));
  emisor.on('error', (error) => recibido.push(['error', error.problemas]));

  const partida: Partida = { v: 1, nivel: 'casa', niveles: {} };
  const avisosDelJuego = crearAvisosParaElHost(emisor);
  avisosDelJuego.alGuardar(partida);
  avisosDelJuego.alCumplirObjetivo('comprar_tortillas');
  avisosDelJuego.alVerPalabra({ en: 'bread', es: 'pan' });
  avisosDelJuego.alSalir('Selector');
  avisosDelJuego.alFallar(new ErrorDeEscenario(['no cargó el nivel']));

  expect(recibido).toEqual([
    ['guardar', partida],
    ['objetivo', 'comprar_tortillas'],
    ['palabra', { en: 'bread', es: 'pan' }],
    ['salida', 'Selector'],
    ['error', ['no cargó el nivel']],
  ]);
});
