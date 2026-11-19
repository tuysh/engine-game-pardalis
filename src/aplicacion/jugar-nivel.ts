// Caso de uso: poner a jugar un nivel ya validado. Monta la escenografía y los personajes,
// conecta los toques y el teclado del jugador con el nivel (caminar, hablar, salir), reproduce sus
// cinemáticas y dibuja un cuadro tras otro.
//
// Lo que recibe y lo que entrega está en nivel-en-juego.ts.

import { crearEstadoDeNivel } from '../dominio/estado.ts';
import type { VariablesDeEstado } from '../dominio/estado.ts';
import type { Punto } from '../dominio/geometria.ts';
import type { Nivel } from '../dominio/nivel.ts';
import { crearTerreno } from '../dominio/terreno.ts';
import { completarTexto } from '../dominio/texto-con-variables.ts';
import { atenderToque } from './atender-toque.ts';
import { CamaraDeEscena } from './camara-de-escena.ts';
import { Cercania } from './cercania.ts';
import { Cinematicas } from './cinematicas.ts';
import { ComentariosDeZona } from './comentarios-de-zona.ts';
import { Conversacion } from './conversacion.ts';
import { crearAccionesDePaso } from './crear-acciones-de-paso.ts';
import { decirLinea } from './decir-linea.ts';
import { buscarDireccionDeAsset } from './direccion-de-asset.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';
import { Exploracion } from './exploracion.ts';
import { FlechaDeSalida } from './flecha-de-salida.ts';
import { FundidoDePantalla } from './fundido-de-pantalla.ts';
import type { AvisosDelNivel, NivelEnJuego, PedidoDeJuego, PuertosParaJugar } from './nivel-en-juego.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';
import {
  crearImagenDeEscena,
  prepararEscenografia,
  prepararImagenesDeEscenas,
  prepararPersonajes,
} from './preparar-escena.ts';
import { Reparto } from './reparto.ts';
import { SalidaDelNivel } from './salida-del-nivel.ts';

const SIN_DIRECCION = { x: 0, y: 0 };

/** La promesa termina cuando el nivel ya se ve y se puede jugar. */
export async function jugarNivel(
  pedido: PedidoDeJuego,
  puertos: PuertosParaJugar,
  avisos: AvisosDelNivel,
): Promise<NivelEnJuego> {
  const { nivel, ubicacion } = pedido;
  const { escenario, interfaz, audio, controles, reloj } = puertos;
  const contenido = nivel.contenido;

  await escenario.montar(prepararEscenografia(nivel, ubicacion));
  const reparto = new Reparto(escenario);
  const personajes = prepararPersonajes(nivel, ubicacion);
  // Todas las imágenes de personajes se piden a la vez, para que la carga dure lo que dura la más lenta.
  await Promise.all(personajes.map((personaje) => reparto.agregar(personaje)));
  // Lo que las escenas usarán más tarde se descarga desde ahora, para que aparezca sin demora cuando le toque.
  await escenario.precargar(prepararImagenesDeEscenas(nivel, ubicacion));

  const exploracion = crearExploracion(nivel, reparto);
  const centroDelLugar = { x: nivel.mundo.anchoEnMetros / 2, y: nivel.mundo.profundidadEnMetros / 2 };
  const camara = new CamaraDeEscena({
    escenario,
    reparto,
    contenido,
    puntos: nivel.mundo.puntos,
    decorado: nivel.mundo.decorado,
    centroDelLugar,
    conMenosMovimiento: pedido.conMenosMovimiento ?? false,
  });
  const fundido = new FundidoDePantalla(interfaz, reloj);

  const estadoInicial = crearEstadoDeNivel(contenido.estado, pedido.variablesGuardadas);
  const estado = new EstadoEnJuego(estadoInicial, (objetivo) => avisos.alCumplirObjetivo(objetivo));
  const direccionDeAsset = (clave: string): string | undefined => {
    return buscarDireccionDeAsset(clave, nivel.assets, ubicacion);
  };

  const piezasDeEscena: PiezasDeEscena = {
    contenido,
    puntos: nivel.mundo.puntos,
    centroDelLugar,
    idiomaBase: pedido.idiomaBase,
    escenario,
    interfaz,
    audio,
    reloj,
    reparto,
    estado,
    minijuegos: pedido.minijuegos,
    direccionDeAsset,
    alVerPalabra: (palabra) => avisos.alVerPalabra(palabra),
  };

  /** A dónde pidió salir la escena en curso con un paso `sale`. `undefined` = no lo ha pedido. */
  let destinoPedido: string | undefined;
  let elNivelTermino = false;
  const acciones = crearAccionesDePaso({
    escena: piezasDeEscena,
    camara,
    fundido,
    video: puertos.video,
    imagenDeAsset: (clave) => crearImagenDeEscena(clave, nivel, ubicacion),
    pedirSalida: (destino) => {
      destinoPedido = destino;
    },
  });

  const musica = contenido.mundo.sonidos.musica;
  if (musica !== undefined) {
    // Si la música no está en los assets, la validación ya lo advirtió: el nivel se juega sin ella.
    audio.ponerMusica(direccionDeAsset(musica));
  }

  const comentarios = new ComentariosDeZona({
    contenido,
    zonas: nivel.mundo.zonas,
    azar: puertos.azar,
    decirComentario(linea, senal) {
      const textoCompleto = completarTexto(linea.texto, estado.actual);
      return decirLinea({ paso: linea, textoCompleto, seCierraConUnToque: false }, senal, piezasDeEscena);
    },
    alFallar: (error) => avisos.alFallar(error),
  });

  /** Al acabar un diálogo o una cinemática: si pidió salir, el nivel termina; si no, todo vuelve a su lugar. */
  const alTerminarUnaEscena = (): void => {
    if (elNivelTermino) return;
    if (destinoPedido !== undefined) {
      const destino = destinoPedido;
      destinoPedido = undefined;
      avisos.alSalir(destino);
      return;
    }
    // Una escena nunca deja al jugador con la cámara en otro lado ni con la pantalla a oscuras.
    camara.volverAlJugador();
    fundido.dejar('abrir');
  };
  const conversacion = new Conversacion({
    contenido,
    estado,
    acciones,
    alFallar: (error) => avisos.alFallar(error),
    alEmpezar: () => {
      // Un comentario nunca se encima con una escena: al empezar una, el comentario se calla.
      comentarios.callar();
      // Y el jugador no sigue caminando hacia el lugar que había tocado.
      if (exploracion !== undefined) {
        exploracion.detener();
      }
    },
    alTerminar: alTerminarUnaEscena,
  });
  const cinematicas = new Cinematicas({
    contenido,
    zonas: nivel.mundo.zonas,
    estado,
    acciones,
    conversacion,
    interfaz,
    cinematicasEnCodigo: pedido.cinematicasEnCodigo ?? {},
    lugares: { puntos: nivel.mundo.puntos, assets: nivel.assets },
    alEmpezar: (id) => avisos.alEmpezarCinematica(id),
    alTerminar: (id) => avisos.alTerminarCinematica(id),
  });
  if (!cinematicas.hayAlgoPorReproducir) {
    // El nivel anterior pudo cerrar a negro antes de salir. Si aquí no hay una cinemática de entrada
    // que abra la pantalla, se abre de una vez.
    fundido.dejar('abrir');
  }

  const flecha = new FlechaDeSalida({ nivel, estado, escenario, interfaz });
  const salida = new SalidaDelNivel({ nivel, estado, conversacion, alSalir: (destino) => avisos.alSalir(destino) });
  const cercania = new Cercania({ nivel, reparto, escenario, interfaz });

  const piezasParaToques = { nivel, reparto, conversacion, salida, exploracion };
  const dejarDeAtenderToques = escenario.alTocar((toque) => atenderToque(toque, piezasParaToques));
  // La tecla de hablar hace lo mismo que tocar al personaje u objeto que el jugador tiene a la mano.
  const dejarDeAtenderLaTecla = controles.alPedirHablar(() => {
    if (exploracion === undefined) return;
    const cercano = cercania.buscar(exploracion.posicion);
    if (cercano !== undefined) {
      atenderToque({ tipo: cercano.tipo, id: cercano.id }, piezasParaToques);
    }
  });

  const dejarDeDibujar = reloj.enCadaCuadro((segundos) => {
    let posicionDelJugador: Punto | undefined;
    if (exploracion !== undefined) {
      posicionDelJugador = exploracion.posicion;
    }
    // Las cinemáticas van primero: si una empieza en este cuadro, el jugador ya no se mueve en él.
    cinematicas.avanzar(posicionDelJugador);

    if (exploracion !== undefined) {
      // Durante un diálogo, una cinemática o un minijuego, el teclado no mueve al jugador.
      const direccion = conversacion.hayDialogoEnCurso ? SIN_DIRECCION : controles.leerDireccion();
      exploracion.avanzar(segundos, direccion);
      comentarios.avanzar(segundos, exploracion.posicion, !conversacion.hayDialogoEnCurso);
      salida.vigilar(exploracion.posicion);
      cercania.actualizar(exploracion.posicion, !conversacion.hayDialogoEnCurso);
    }
    camara.actualizar(segundos);
    escenario.dibujar(segundos);

    // La flecha se coloca después de dibujar, cuando la cámara ya está en su lugar de este cuadro.
    // Durante una cinemática no se muestra: distrae de lo que se está contando.
    if (cinematicas.hayUnaEnCurso) {
      flecha.ocultar();
    } else {
      flecha.actualizar();
    }
  });

  return {
    leerVariables(): VariablesDeEstado {
      return estado.actual.variables;
    },
    interrumpir(): void {
      if (cinematicas.hayUnaEnCurso) {
        cinematicas.saltar();
      } else {
        conversacion.interrumpir();
      }
    },
    reproducirCinematica(id: string): Promise<void> {
      return cinematicas.reproducir(id);
    },
    terminar(): void {
      elNivelTermino = true;
      cinematicas.descartarTodo();
      conversacion.interrumpir();
      comentarios.callar();
      flecha.ocultar();
      cercania.ocultar();
      audio.ponerMusica(undefined);
      dejarDeAtenderToques();
      dejarDeAtenderLaTecla();
      dejarDeDibujar();
    },
  };
}

/** El control libre del jugador, o `undefined` si el nivel no tiene jugador. */
function crearExploracion(nivel: Nivel, reparto: Reparto): Exploracion | undefined {
  const jugador = nivel.contenido.jugador;
  if (jugador === undefined) return undefined;

  return new Exploracion({
    reparto,
    terreno: crearTerreno(nivel.mundo),
    idDelJugador: jugador.personaje,
    velocidadEnMetrosPorSegundo: jugador.velocidadEnMetrosPorSegundo,
  });
}
