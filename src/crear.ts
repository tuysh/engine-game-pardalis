// `crearEscenario()`: la única puerta de entrada del motor en el navegador (docs/DISENO-3.0.md §4).
// Es la raíz de composición: el único lugar que crea los adaptadores del navegador y se los entrega a la aplicación.

import { AudioDelNavegador } from './adaptadores/audio/audio-del-navegador.ts';
import { ControlesDelTeclado } from './adaptadores/dom/controles-del-teclado.ts';
import { crearLienzo, leerDensidadDePantalla } from './adaptadores/dom/crear-lienzo.ts';
import { InterfazDelNavegador } from './adaptadores/dom/interfaz-del-navegador.ts';
import { leerSiSePrefiereMenosMovimiento } from './adaptadores/dom/preferencia-de-movimiento.ts';
import { RelojDelNavegador } from './adaptadores/dom/reloj-del-navegador.ts';
import { revisarDondeMontar } from './adaptadores/dom/revisar-elemento.ts';
import { VideoDelNavegador } from './adaptadores/dom/video-del-navegador.ts';
import { LectorDeNivelesDeJson } from './adaptadores/json/lector-de-niveles-de-json.ts';
import { CargadorDeRed } from './adaptadores/red/cargador-de-red.ts';
import { EscenarioDeThree } from './adaptadores/three/escenario-de-three.ts';
import { LectorDeMapasDeTiled } from './adaptadores/tiled/lector-de-mapas-de-tiled.ts';
import { JuegoEnCurso } from './aplicacion/juego-en-curso.ts';
import { leerNivelPorJugar } from './aplicacion/leer-nivel-por-jugar.ts';
import type { FuenteDeNiveles, NivelPorJugar } from './aplicacion/leer-nivel-por-jugar.ts';
import type { HerramientasDeDepuracion } from './aplicacion/nivel-en-juego.ts';
import { validarNivel } from './aplicacion/validar-nivel.ts';
import { crearAvisosParaElHost } from './avisos-para-el-host.ts';
import { crearAzarConSemilla } from './dominio/azar-con-semilla.ts';
import { describirError, ErrorDeEscenario } from './dominio/error-de-escenario.ts';
import { leerPartida } from './dominio/partida.ts';
import type { Partida } from './dominio/partida.ts';
import { EmisorDeEventos } from './emisor-de-eventos.ts';
import type { Juego } from './juego.ts';
import { JuegoCreado } from './juego-creado.ts';
import type { AdaptadoresDelJuego } from './juego-creado.ts';
import type { OpcionesDeEscenario } from './opciones-de-escenario.ts';
import { PausaDelJuego } from './pausa-del-juego.ts';
import { revisarOpciones } from './revisar-opciones.ts';
import type { PanelDeDepuracion } from './puertos/panel-de-depuracion.ts';

/**
 * Crea el juego dentro de `elemento`, ocupando todo su tamaño.
 * La promesa termina cuando el nivel ya se puede jugar y rechaza con `ErrorDeEscenario`
 * si no pudo arrancar; `error.problemas` trae un mensaje por problema.
 */
export async function crearEscenario(elemento: HTMLElement, opciones: OpcionesDeEscenario): Promise<Juego> {
  revisarLoRecibido(elemento, opciones);
  revisarQueNoSeCancelo(opciones);
  const cargador = new CargadorDeRed(opciones.origenesPermitidos ?? []);
  const fuente = crearFuenteDeNiveles(opciones, cargador);
  const partidaInicial = leerPartidaDelHost(opciones.partida);

  // Lo que depende de la red va antes de montar nada en la página: si el primer nivel está roto
  // o no se puede traer el panel de depuración, no queda nada a medias.
  const primerNivel = await leerNivelPorJugar(elegirPrimerNivel(opciones, partidaInicial), fuente);
  const crearPanelDeDepuracion = await importarPanelDeDepuracion(opciones);
  revisarQueNoSeCancelo(opciones);

  const adaptadores = crearAdaptadores(elemento, crearPanelDeDepuracion);
  const emisor = new EmisorDeEventos();
  const pausa = new PausaDelJuego(adaptadores.reloj, [adaptadores.audio, adaptadores.video]);
  const juegoEnCurso = crearJuegoEnCurso(opciones, { adaptadores, emisor, pausa, cargador, fuente, partidaInicial });
  const juego = new JuegoCreado({ juegoEnCurso, emisor, pausa, adaptadores });

  try {
    await empezarElPrimerNivel(primerNivel, opciones, { juego, juegoEnCurso, pausa, adaptadores });
  } catch (error) {
    // Si algo falla o se cancela a medio armar, no se deja nada montado en la página.
    juego.destruir();
    throw error;
  }
  return juego;
}

/**
 * Lo que entrega el host viene de afuera (muchas veces de JavaScript sin tipos): se revisa antes de usarlo.
 * Las advertencias van a la consola; con errores, lanza un `ErrorDeEscenario` que los trae todos.
 */
function revisarLoRecibido(elemento: unknown, opciones: unknown): void {
  const revision = revisarOpciones(opciones);
  for (const advertencia of revision.advertencias) {
    console.warn(`[escenario-engine] ${advertencia}`);
  }

  const errores = [...revision.errores];
  const problemaDelElemento = revisarDondeMontar(elemento);
  if (problemaDelElemento !== undefined) {
    errores.push(problemaDelElemento);
  }
  if (errores.length > 0) {
    throw new ErrorDeEscenario(errores);
  }
}

/** Crea el panel de depuración dentro del elemento del juego. */
type CreadorDelPanelDeDepuracion = (elemento: HTMLElement) => PanelDeDepuracion;

/**
 * Con `depurar: true`, trae el panel de depuración y devuelve cómo crearlo; sin él, `undefined`.
 * Se importa hasta que se pide, para que el modo depuración no pese en producción.
 */
async function importarPanelDeDepuracion(
  opciones: OpcionesDeEscenario,
): Promise<CreadorDelPanelDeDepuracion | undefined> {
  if (opciones.depurar !== true) return undefined;
  const modulo = await import('./adaptadores/dom/panel-de-depuracion-del-navegador.ts');
  return (elemento) => new modulo.PanelDeDepuracionDelNavegador(elemento);
}

function crearAdaptadores(
  elemento: HTMLElement,
  crearPanelDeDepuracion: CreadorDelPanelDeDepuracion | undefined,
): AdaptadoresDelJuego {
  // El escenario va primero: es el único que puede fallar al crearse (si el navegador no tiene WebGL),
  // y así no queda ningún otro adaptador escuchando el teclado sin que nadie lo destruya.
  const escenario = crearEscenarioDeThree(elemento);
  let panelDeDepuracion: PanelDeDepuracion | undefined;
  if (crearPanelDeDepuracion !== undefined) {
    panelDeDepuracion = crearPanelDeDepuracion(elemento);
  }
  return {
    escenario,
    reloj: new RelojDelNavegador(),
    audio: new AudioDelNavegador(),
    controles: new ControlesDelTeclado(),
    video: new VideoDelNavegador(elemento),
    interfaz: new InterfazDelNavegador(elemento),
    panelDeDepuracion,
  };
}

/** Lo que `crearEscenario()` ya tiene armado cuando crea el juego en curso. */
interface BaseDelJuego {
  readonly adaptadores: AdaptadoresDelJuego;
  readonly emisor: EmisorDeEventos;
  readonly pausa: PausaDelJuego;
  readonly cargador: CargadorDeRed;
  readonly fuente: FuenteDeNiveles;
  readonly partidaInicial: Partida | undefined;
}

function crearJuegoEnCurso(opciones: OpcionesDeEscenario, base: BaseDelJuego): JuegoEnCurso {
  const { escenario, interfaz, audio, video, controles, reloj, panelDeDepuracion } = base.adaptadores;
  // Con `semilla`, el azar del juego es siempre el mismo: sirve para pruebas.
  const azar = opciones.semilla === undefined ? Math.random : crearAzarConSemilla(opciones.semilla);

  let depuracion: HerramientasDeDepuracion | undefined;
  if (panelDeDepuracion !== undefined) {
    // La cámara libre pausa el juego mientras se encuadra un plano.
    const pausa = base.pausa;
    depuracion = {
      panel: panelDeDepuracion,
      pausarElJuego: () => pausa.pausar(),
      reanudarElJuego: () => pausa.reanudar(),
    };
  }

  return new JuegoEnCurso({
    fuente: base.fuente,
    raizDeAssets: opciones.raizDeAssets,
    cargador: base.cargador,
    idiomaBase: opciones.idioma ?? 'es',
    minijuegos: opciones.minijuegos ?? {},
    cinematicasEnCodigo: opciones.cinematicas ?? {},
    conMenosMovimiento: leerSiSePrefiereMenosMovimiento(),
    alCargar: opciones.alCargar,
    depuracion,
    puertos: { escenario, interfaz, audio, video, controles, reloj, azar },
    avisos: crearAvisosParaElHost(base.emisor),
    partidaInicial: base.partidaInicial,
  });
}

/** Lo que hace falta para poner a jugar el primer nivel. */
interface PiezasParaEmpezar {
  readonly juego: JuegoCreado;
  readonly juegoEnCurso: JuegoEnCurso;
  readonly pausa: PausaDelJuego;
  readonly adaptadores: AdaptadoresDelJuego;
}

/** Pone a jugar el primer nivel y, si así se pidió, muestra el botón de inicio. */
async function empezarElPrimerNivel(
  primerNivel: NivelPorJugar,
  opciones: OpcionesDeEscenario,
  piezas: PiezasParaEmpezar,
): Promise<void> {
  const { pausa, adaptadores } = piezas;
  const empiezaConElBoton = opciones.iniciarCon !== 'host';
  if (empiezaConElBoton) {
    // Hasta que toquen el botón no pasa el tiempo: así la cinemática de entrada empieza con ese toque,
    // que es también el que deja al navegador reproducir sonido (§7.5).
    pausa.esperarElInicio();
  }
  await piezas.juegoEnCurso.jugar(primerNivel);
  revisarQueNoSeCancelo(opciones);

  piezas.juego.proyeccion = opciones.proyeccion ?? false;
  // Con el tiempo detenido no llegan cuadros: este es el que se ve detrás del botón de inicio.
  adaptadores.escenario.dibujar(0);
  if (empiezaConElBoton) {
    adaptadores.interfaz.mostrarBotonDeInicio(() => pausa.empezar());
  }
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
