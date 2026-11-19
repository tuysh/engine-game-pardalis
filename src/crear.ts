// `crearEscenario()`: la única puerta de entrada del motor en el navegador (docs/DISENO-3.0.md §4).
// Es la raíz de composición: el único lugar que crea los adaptadores del navegador y se los entrega a la aplicación.
//
// Estado: todavía no usa `alCargar` ni `depurar`.

import { AudioDelNavegador } from './adaptadores/audio/audio-del-navegador.ts';
import { ControlesDelTeclado } from './adaptadores/dom/controles-del-teclado.ts';
import { crearLienzo, leerDensidadDePantalla } from './adaptadores/dom/crear-lienzo.ts';
import { InterfazDelNavegador } from './adaptadores/dom/interfaz-del-navegador.ts';
import { leerSiSePrefiereMenosMovimiento } from './adaptadores/dom/preferencia-de-movimiento.ts';
import { RelojDelNavegador } from './adaptadores/dom/reloj-del-navegador.ts';
import { VideoDelNavegador } from './adaptadores/dom/video-del-navegador.ts';
import { LectorDeNivelesDeJson } from './adaptadores/json/lector-de-niveles-de-json.ts';
import { CargadorDeRed } from './adaptadores/red/cargador-de-red.ts';
import { EscenarioDeThree } from './adaptadores/three/escenario-de-three.ts';
import { LectorDeMapasDeTiled } from './adaptadores/tiled/lector-de-mapas-de-tiled.ts';
import { JuegoEnCurso } from './aplicacion/juego-en-curso.ts';
import type { AvisosDelJuego } from './aplicacion/juego-en-curso.ts';
import { leerNivelPorJugar } from './aplicacion/leer-nivel-por-jugar.ts';
import type { FuenteDeNiveles } from './aplicacion/leer-nivel-por-jugar.ts';
import { validarNivel } from './aplicacion/validar-nivel.ts';
import { crearAzarConSemilla } from './dominio/azar-con-semilla.ts';
import { ErrorDeEscenario } from './dominio/error-de-escenario.ts';
import { leerPartida } from './dominio/partida.ts';
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
  const fuente = crearFuenteDeNiveles(opciones, cargador);
  const partidaInicial = leerPartidaDelHost(opciones.partida);

  // El primer nivel se lee y se valida antes de montar nada en la página: si está roto, no queda nada a medias.
  const primerNivel = await leerNivelPorJugar(elegirPrimerNivel(opciones, partidaInicial), fuente);
  revisarQueNoSeCancelo(opciones);

  // El escenario va primero: es el único que puede fallar al crearse (si el navegador no tiene WebGL),
  // y así no queda ningún otro adaptador escuchando el teclado sin que nadie lo destruya.
  const escenario = crearEscenarioDeThree(elemento);
  const emisor = new EmisorDeEventos();
  const reloj = new RelojDelNavegador();
  const audio = new AudioDelNavegador();
  const controles = new ControlesDelTeclado();
  const video = new VideoDelNavegador(elemento);
  const interfaz = new InterfazDelNavegador(elemento);
  // Con `semilla`, el azar del juego es siempre el mismo: sirve para pruebas.
  const azar = opciones.semilla === undefined ? Math.random : crearAzarConSemilla(opciones.semilla);

  const juegoEnCurso = new JuegoEnCurso({
    fuente,
    raizDeAssets: opciones.raizDeAssets,
    cargador,
    idiomaBase: opciones.idioma ?? 'es',
    minijuegos: opciones.minijuegos ?? {},
    cinematicasEnCodigo: opciones.cinematicas ?? {},
    conMenosMovimiento: leerSiSePrefiereMenosMovimiento(),
    puertos: { escenario, interfaz, audio, video, controles, reloj, azar },
    avisos: crearAvisos(emisor),
    partidaInicial,
  });
  const juego = new JuegoCreado({ juegoEnCurso, emisor, escenario, interfaz, audio, video, controles, reloj });

  try {
    const empiezaConElBoton = opciones.iniciarCon !== 'host';
    if (empiezaConElBoton) {
      // Hasta que toquen el botón no pasa el tiempo: así la cinemática de entrada empieza con ese toque,
      // que es también el que deja al navegador reproducir sonido (§7.5).
      juego.esperarElInicio();
    }
    await juegoEnCurso.jugar(primerNivel);
    revisarQueNoSeCancelo(opciones);

    juego.proyeccion = opciones.proyeccion ?? false;
    // Con el tiempo detenido no llegan cuadros: este es el que se ve detrás del botón de inicio.
    escenario.dibujar(0);
    if (empiezaConElBoton) {
      interfaz.mostrarBotonDeInicio(() => juego.empezar());
    }
  } catch (error) {
    // Si algo falla o se cancela a medio armar, no se deja nada montado en la página.
    juego.destruir();
    throw error;
  }
  return juego;
}

/** Los niveles se leen de la red y se validan con los minijuegos y las cinemáticas que registró el host. */
function crearFuenteDeNiveles(opciones: OpcionesDeEscenario, cargador: CargadorDeRed): FuenteDeNiveles {
  const lectores = { cargador, lector: new LectorDeNivelesDeJson(), lectorDeMapas: new LectorDeMapasDeTiled() };
  return {
    niveles: opciones.niveles ?? {},
    leerNivel: (direccionDelNivel) => {
      const pedido = {
        direccionDelNivel,
        minijuegos: Object.keys(opciones.minijuegos ?? {}),
        cinematicas: Object.keys(opciones.cinematicas ?? {}),
        raizDeAssets: opciones.raizDeAssets,
      };
      return validarNivel(pedido, lectores);
    },
  };
}

/**
 * Con una partida guardada, el juego continúa en el nivel donde se quedó el jugador (si ese nivel
 * sigue registrado). Sin ella, empieza en `opciones.nivel`.
 */
function elegirPrimerNivel(opciones: OpcionesDeEscenario, partida: Partida | undefined): string {
  const niveles = opciones.niveles ?? {};
  if (partida !== undefined && Object.hasOwn(niveles, partida.nivel)) {
    return partida.nivel;
  }
  return opciones.nivel;
}

/** Una partida que no sirve se ignora con una advertencia: nunca impide jugar. */
function leerPartidaDelHost(partidaDelHost: unknown): Partida | undefined {
  const lectura = leerPartida(partidaDelHost);
  if (lectura.advertencia !== undefined) {
    console.warn(`[escenario-engine] ${lectura.advertencia}`);
  }
  return lectura.partida;
}

/** Convierte lo que el juego avisa en los eventos que escucha el host con `juego.on(...)`. */
function crearAvisos(emisor: EmisorDeEventos): AvisosDelJuego {
  return {
    alGuardar: (partida) => emisor.emitir('guardar', partida),
    alCumplirObjetivo: (objetivo) => emisor.emitir('objetivo', objetivo),
    alVerPalabra: (palabra) => emisor.emitir('palabra', palabra),
    alCambiarDeNivel: (id, anterior) => emisor.emitir('nivel', { id, anterior }),
    alEmpezarCinematica: (id) => emisor.emitir('cinematica', { id, fase: 'inicio' }),
    alTerminarCinematica: (id) => emisor.emitir('cinematica', { id, fase: 'fin' }),
    alSalir: (destino) => emisor.emitir('salida', destino),
    alFallar: (error) => emisor.emitir('error', error),
  };
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
