// `crearEscenario()`: la única puerta de entrada del motor en el navegador (docs/DISENO-3.0.md §4).
// Es la raíz de composición: el único lugar que crea los adaptadores del navegador y se los entrega a la aplicación.
//
// Estado: carga y valida un nivel, lo dibuja, y deja caminar, hablar con personajes, jugar minijuegos y salir.
// Todavía no usa `cinematicas`, `alCargar`, `depurar` ni `semilla`. Cada cosa llega en su fase (§13).

import { AudioDelNavegador } from './adaptadores/audio/audio-del-navegador.ts';
import { ControlesDelTeclado } from './adaptadores/dom/controles-del-teclado.ts';
import { crearLienzo, leerDensidadDePantalla } from './adaptadores/dom/crear-lienzo.ts';
import { InterfazDelNavegador } from './adaptadores/dom/interfaz-del-navegador.ts';
import { RelojDelNavegador } from './adaptadores/dom/reloj-del-navegador.ts';
import { LectorDeNivelesDeJson } from './adaptadores/json/lector-de-niveles-de-json.ts';
import { CargadorDeRed } from './adaptadores/red/cargador-de-red.ts';
import { EscenarioDeThree } from './adaptadores/three/escenario-de-three.ts';
import { LectorDeMapasDeTiled } from './adaptadores/tiled/lector-de-mapas-de-tiled.ts';
import { jugarNivel } from './aplicacion/jugar-nivel.ts';
import type { AvisosDelNivel, NivelEnJuego } from './aplicacion/jugar-nivel.ts';
import { validarNivel } from './aplicacion/validar-nivel.ts';
import { ErrorDeEscenario } from './dominio/error-de-escenario.ts';
import type { Nivel } from './dominio/nivel.ts';
import { actualizarPartida, leerPartida, variablesGuardadasDe } from './dominio/partida.ts';
import type { Partida } from './dominio/partida.ts';
import { EmisorDeEventos } from './emisor-de-eventos.ts';
import type { Juego } from './juego.ts';
import { JuegoCreado } from './juego-creado.ts';
import type { OpcionesDeEscenario } from './opciones-de-escenario.ts';

/**
 * Crea el juego dentro de `elemento`, ocupando todo su tamaño.
 * La promesa termina cuando el nivel ya se puede jugar y rechaza con `ErrorDeEscenario`
 * si no pudo arrancar; `error.problemas` trae un mensaje por problema.
 */
export async function crearEscenario(elemento: HTMLElement, opciones: OpcionesDeEscenario): Promise<Juego> {
  revisarQueNoSeCancelo(opciones);

  const cargador = new CargadorDeRed(opciones.origenesPermitidos ?? []);
  const direccionDelNivel = buscarDireccionDelNivel(opciones);
  const nivel = await cargarNivelValidado(direccionDelNivel, opciones, cargador);
  revisarQueNoSeCancelo(opciones);

  const idDelNivel = nivel.contenido.meta.id;
  const partidaInicial = leerPartidaDelHost(opciones.partida);
  const emisor = new EmisorDeEventos();

  const reloj = new RelojDelNavegador();
  const audio = new AudioDelNavegador();
  const controles = new ControlesDelTeclado();
  const escenario = crearEscenarioDeThree(elemento);
  const interfaz = new InterfazDelNavegador(elemento);

  // El juego todavía no existe cuando se arman los avisos, así que la partida se lee a través de esta variable.
  let nivelEnJuego: NivelEnJuego | undefined;
  const leerPartidaActual = (): Partida => {
    const variables = nivelEnJuego === undefined ? {} : nivelEnJuego.leerVariables();
    return actualizarPartida(partidaInicial, idDelNivel, variables);
  };
  const avisos: AvisosDelNivel = {
    alCumplirObjetivo(objetivo) {
      emisor.emitir('objetivo', objetivo);
      emisor.emitir('guardar', leerPartidaActual());
    },
    alVerPalabra(palabra) {
      emisor.emitir('palabra', palabra);
    },
    alSalir(destino) {
      emisor.emitir('guardar', leerPartidaActual());
      emisor.emitir('salida', destino);
    },
    alFallar(error) {
      console.error('[escenario-engine] un diálogo falló y se dio por terminado:', error);
      emisor.emitir('error', new ErrorDeEscenario([describirError(error)]));
    },
  };

  try {
    const pedido = {
      nivel,
      ubicacion: { direccionDelNivel, raizDeAssets: opciones.raizDeAssets, cargador },
      idiomaBase: opciones.idioma ?? 'es',
      minijuegos: opciones.minijuegos ?? {},
      variablesGuardadas: variablesGuardadasDe(partidaInicial, idDelNivel),
    };
    nivelEnJuego = await jugarNivel(pedido, { escenario, interfaz, audio, controles, reloj }, avisos);
    revisarQueNoSeCancelo(opciones);
  } catch (error) {
    // Si algo falla o se cancela a medio armar, no se deja nada montado en la página.
    reloj.detener();
    controles.destruir();
    audio.destruir();
    interfaz.destruir();
    escenario.destruir();
    throw error;
  }

  if (opciones.iniciarCon !== 'host') {
    // El toque al botón es lo que deja al navegador reproducir sonido; por ahora no hay nada más que arrancar.
    interfaz.mostrarBotonDeInicio(() => {});
  }

  return new JuegoCreado({
    idDelNivel,
    partidaInicial,
    emisor,
    escenario,
    interfaz,
    audio,
    controles,
    reloj,
    nivelEnJuego,
    proyeccion: opciones.proyeccion ?? false,
  });
}

/** `opciones.nivel` es un id de `opciones.niveles` o, si no está ahí, directamente la dirección de un `nivel.json`. */
function buscarDireccionDelNivel(opciones: OpcionesDeEscenario): string {
  const niveles = opciones.niveles ?? {};
  if (Object.hasOwn(niveles, opciones.nivel)) {
    return niveles[opciones.nivel]!; // `hasOwn` acaba de comprobar que existe
  }
  return opciones.nivel;
}

/** Carga y valida el nivel. Las advertencias van a la consola; con errores, rechaza con todos ellos. */
async function cargarNivelValidado(
  direccionDelNivel: string,
  opciones: OpcionesDeEscenario,
  cargador: CargadorDeRed,
): Promise<Nivel> {
  const pedido = {
    direccionDelNivel,
    minijuegos: Object.keys(opciones.minijuegos ?? {}),
    raizDeAssets: opciones.raizDeAssets,
  };
  const lectores = { cargador, lector: new LectorDeNivelesDeJson(), lectorDeMapas: new LectorDeMapasDeTiled() };

  const resultado = await validarNivel(pedido, lectores);
  for (const advertencia of resultado.advertencias) {
    console.warn(`[escenario-engine] ${advertencia}`);
  }
  if (resultado.nivel === undefined) {
    throw new ErrorDeEscenario(resultado.errores);
  }
  return resultado.nivel;
}

/** Una partida que no sirve se ignora con una advertencia: nunca impide jugar. */
function leerPartidaDelHost(partidaDelHost: unknown): Partida | undefined {
  const lectura = leerPartida(partidaDelHost);
  if (lectura.advertencia !== undefined) {
    console.warn(`[escenario-engine] ${lectura.advertencia}`);
  }
  return lectura.partida;
}

function crearEscenarioDeThree(elemento: HTMLElement): EscenarioDeThree {
  try {
    return new EscenarioDeThree(elemento, { crearLienzo, densidadDePantalla: leerDensidadDePantalla() });
  } catch (error) {
    throw new ErrorDeEscenario([`el navegador no pudo preparar el lienzo 3D (WebGL): ${describirError(error)}`]);
  }
}

/** Si el host canceló la creación con `opciones.senal`, lanza el motivo de la cancelación. */
function revisarQueNoSeCancelo(opciones: OpcionesDeEscenario): void {
  if (opciones.senal !== undefined) {
    opciones.senal.throwIfAborted();
  }
}

function describirError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
