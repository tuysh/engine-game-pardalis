// Caso de uso: poner a jugar un nivel ya validado. Lo arma (armar-nivel.ts), conecta los toques y el teclado
// del jugador con el nivel (caminar, hablar, salir) y avanza y dibuja un cuadro tras otro.
//
// Lo que recibe y lo que entrega está en nivel-en-juego.ts.

import type { Punto } from '../dominio/geometria.ts';
import { crearGuiasDelMundo } from '../dominio/guias-de-depuracion.ts';
import type { Audio } from '../puertos/audio.ts';
import type { Escenario } from '../puertos/escenario.ts';
import { armarNivel } from './armar-nivel.ts';
import type { NivelArmado } from './armar-nivel.ts';
import { atenderToque } from './atender-toque.ts';
import type { CamaraLibre } from './camara-libre.ts';
import { buscarDireccionDeAsset } from './direccion-de-asset.ts';
import type { AvisosDelNivel, NivelEnJuego, PedidoDeJuego, PuertosParaJugar } from './nivel-en-juego.ts';

const SIN_DIRECCION = { x: 0, y: 0 };

/** La promesa termina cuando el nivel ya se ve y se puede jugar. */
export async function jugarNivel(
  pedido: PedidoDeJuego,
  puertos: PuertosParaJugar,
  avisos: AvisosDelNivel,
): Promise<NivelEnJuego> {
  const armado = await armarNivel(pedido, puertos, avisos);
  const camaraLibre = await prepararDepuracion(pedido, puertos.escenario, armado);
  ponerLaMusicaDelNivel(pedido, puertos.audio);
  armado.escenas.abrirLaPantallaSiQuedoEnNegro();

  const dejarDeAtenderAlJugador = atenderAlJugador(armado, puertos, camaraLibre);
  const dejarDeDibujar = puertos.reloj.enCadaCuadro((segundos) => avanzarUnCuadro(armado, puertos, segundos));

  return {
    leerVariables: () => armado.estado.actual.variables,
    leerEstado: () => armado.estado.actual,
    interrumpir: () => armado.escenas.interrumpir(),
    reproducirCinematica: (id) => armado.escenas.reproducirCinematica(id),
    terminar(): void {
      armado.escenas.terminar();
      armado.comentarios.callar();
      armado.flecha.ocultar();
      armado.cercania.ocultar();
      armado.senales.ocultar();
      puertos.audio.ponerMusica(undefined);
      if (camaraLibre !== undefined) {
        camaraLibre.destruir();
      }
      dejarDeAtenderAlJugador();
      dejarDeDibujar();
    },
  };
}

/** Pone la música de fondo del nivel, si el nivel la nombra. */
function ponerLaMusicaDelNivel(pedido: PedidoDeJuego, audio: Audio): void {
  const musica = pedido.nivel.contenido.mundo.sonidos.musica;
  if (musica === undefined) return;
  // Si la música no está en los assets, la validación ya lo advirtió: el nivel se juega sin ella.
  audio.ponerMusica(buscarDireccionDeAsset(musica, pedido.nivel.assets, pedido.ubicacion));
}

/**
 * En modo depuración, dibuja las guías del mapa y crea la cámara libre (docs/DISENO-3.0.md §9.3).
 * Sin depuración devuelve `undefined`.
 */
async function prepararDepuracion(
  pedido: PedidoDeJuego,
  escenario: Escenario,
  armado: NivelArmado,
): Promise<CamaraLibre | undefined> {
  if (pedido.depuracion === undefined) return undefined;

  const nivel = pedido.nivel;
  await escenario.mostrarGuias(crearGuiasDelMundo(nivel.mundo));
  // La cámara libre se importa hasta que hace falta: así el modo depuración no pesa en producción.
  const modulo = await import('./camara-libre.ts');
  return new modulo.CamaraLibre({
    contenido: nivel.contenido,
    puntos: nivel.mundo.puntos,
    decorado: nivel.mundo.decorado,
    centroDelLugar: armado.centroDelLugar,
    escenario,
    reparto: armado.reparto,
    panel: pedido.depuracion.panel,
    pausarElJuego: pedido.depuracion.pausarElJuego,
    reanudarElJuego: pedido.depuracion.reanudarElJuego,
  });
}

/**
 * Conecta al jugador con el nivel: sus toques al escenario y la tecla de hablar.
 * Devuelve una función que los desconecta.
 */
function atenderAlJugador(
  armado: NivelArmado,
  puertos: PuertosParaJugar,
  camaraLibre: CamaraLibre | undefined,
): () => void {
  const { nivel, reparto, exploracion, salida, cercania, acompanante } = armado;
  const piezasParaToques = { nivel, reparto, conversacion: armado.escenas.conversacion, salida, exploracion, acompanante };

  const dejarDeAtenderToques = puertos.escenario.alTocar((toque) => {
    // Con la cámara libre activa, un toque no es para el juego: fija a qué mira el plano que se encuadra.
    if (camaraLibre !== undefined && camaraLibre.estaActiva) {
      camaraLibre.atenderToque(toque);
      return;
    }
    atenderToque(toque, piezasParaToques);
  });
  // La tecla de hablar hace lo mismo que tocar al personaje u objeto que el jugador tiene a la mano.
  const dejarDeAtenderLaTecla = puertos.controles.alPedirHablar(() => {
    if (exploracion === undefined) return;
    const cercano = cercania.buscar(exploracion.posicion);
    if (cercano !== undefined) {
      atenderToque({ tipo: cercano.tipo, id: cercano.id }, piezasParaToques);
    }
  });

  return () => {
    dejarDeAtenderToques();
    dejarDeAtenderLaTecla();
  };
}

/** Lo que pasa en cada cuadro: avanzan las escenas, el jugador y la cámara, y se dibuja. */
function avanzarUnCuadro(armado: NivelArmado, puertos: PuertosParaJugar, segundos: number): void {
  const { exploracion, escenas, comentarios, salida, cercania, flecha } = armado;

  let posicionDelJugador: Punto | undefined;
  if (exploracion !== undefined) {
    posicionDelJugador = exploracion.posicion;
  }
  // Las escenas van primero: si una cinemática empieza en este cuadro, el jugador ya no se mueve en él.
  escenas.avanzar(posicionDelJugador);

  if (exploracion !== undefined) {
    // Durante un diálogo, una cinemática o un minijuego, el teclado no mueve al jugador.
    const direccion = escenas.hayUnaEnCurso ? SIN_DIRECCION : puertos.controles.leerDireccion();
    exploracion.avanzar(segundos, direccion);
    comentarios.avanzar(segundos, exploracion.posicion, !escenas.hayUnaEnCurso);
    salida.vigilar(exploracion.posicion);
    cercania.actualizar(exploracion.posicion, !escenas.hayUnaEnCurso);
  }
  // Quien acompaña al jugador lo sigue solo mientras explora: en una escena lo mueven los pasos.
  if (armado.acompanante !== undefined && !escenas.hayUnaEnCurso) {
    armado.acompanante.avanzar(segundos);
  }
  armado.camara.actualizar(segundos);
  armado.visibilidad.actualizar();
  puertos.escenario.dibujar(segundos);

  // La flecha se coloca después de dibujar, cuando la cámara ya está en su lugar de este cuadro.
  // Durante una cinemática no se muestra: distrae de lo que se está contando.
  if (escenas.hayUnaCinematicaEnCurso) {
    flecha.ocultar();
  } else {
    flecha.actualizar();
  }
  // Las estrellitas de lo pendiente, solo mientras se explora; no encima del aviso de «a la mano».
  armado.senales.actualizar(!escenas.hayUnaEnCurso, cercania.loQueTieneElAviso);
}
