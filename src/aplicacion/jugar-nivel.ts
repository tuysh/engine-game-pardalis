// Caso de uso: poner a jugar un nivel ya validado. Monta la escenografía y los personajes,
// conecta los toques y el teclado del jugador con el nivel (caminar, hablar, salir) y dibuja un cuadro tras otro.
//

import { crearEstadoDeNivel } from '../dominio/estado.ts';
import type { VariablesDeEstado } from '../dominio/estado.ts';
import type { Idioma } from '../dominio/idioma.ts';
import type { Nivel } from '../dominio/nivel.ts';
import type { PalabraDeVocabulario } from '../dominio/paso.ts';
import { crearTerreno } from '../dominio/terreno.ts';
import { completarTexto } from '../dominio/texto-con-variables.ts';
import type { Audio } from '../puertos/audio.ts';
import type { Azar } from '../puertos/azar.ts';
import type { Controles } from '../puertos/controles.ts';
import type { Escenario } from '../puertos/escenario.ts';
import type { Interfaz } from '../puertos/interfaz.ts';
import type { Minijuego } from '../puertos/minijuego.ts';
import type { Reloj } from '../puertos/reloj.ts';
import { atenderToque } from './atender-toque.ts';
import { Cercania } from './cercania.ts';
import { ComentariosDeZona } from './comentarios-de-zona.ts';
import { Conversacion } from './conversacion.ts';
import { crearAccionesDePaso } from './crear-acciones-de-paso.ts';
import { decirLinea } from './decir-linea.ts';
import { buscarDireccionDeAsset } from './direccion-de-asset.ts';
import type { UbicacionDeAssets } from './direccion-de-asset.ts';
import { EstadoEnJuego } from './estado-en-juego.ts';
import { Exploracion } from './exploracion.ts';
import { FlechaDeSalida } from './flecha-de-salida.ts';
import type { PiezasDeEscena } from './piezas-de-escena.ts';
import { prepararEscenografia, prepararPersonajes } from './preparar-escena.ts';
import { Reparto } from './reparto.ts';
import { SalidaDelNivel } from './salida-del-nivel.ts';

const SIN_DIRECCION = { x: 0, y: 0 };

/** Lo que se va a jugar. */
export interface PedidoDeJuego {
  readonly nivel: Nivel;
  readonly ubicacion: UbicacionDeAssets;
  /** El idioma del sitio. */
  readonly idiomaBase: Idioma;
  /** Los minijuegos que registró el host, por nombre. */
  readonly minijuegos: Readonly<Record<string, Minijuego>>;
  /** Las variables del nivel en una partida guardada. `undefined` = el nivel empieza de cero. */
  readonly variablesGuardadas?: VariablesDeEstado;
}

export interface PuertosParaJugar {
  readonly escenario: Escenario;
  readonly interfaz: Interfaz;
  readonly audio: Audio;
  readonly controles: Controles;
  readonly reloj: Reloj;
  readonly azar: Azar;
}

/** Cómo el nivel le avisa de lo que pasa a quien lo puso a jugar. */
export interface AvisosDelNivel {
  alCumplirObjetivo(objetivo: string): void;
  alVerPalabra(palabra: PalabraDeVocabulario): void;
  /** El jugador salió por la salida del nivel hacia ese destino. */
  alSalir(destino: string): void;
  /** Un diálogo falló con un error inesperado y se dio por terminado. */
  alFallar(error: unknown): void;
}

/** Un nivel que se está jugando. */
export interface NivelEnJuego {
  /** Las variables del nivel en este momento, para guardarlas en una partida. */
  leerVariables(): VariablesDeEstado;
  /** Termina el diálogo en curso. Si no hay ninguno, no hace nada. */
  interrumpir(): void;
  /** Deja de atender toques y de dibujar, y termina el diálogo en curso. No destruye el escenario. */
  terminar(): void;
}

/** La promesa termina cuando el nivel ya se ve y se puede jugar. */
export async function jugarNivel(
  pedido: PedidoDeJuego,
  puertos: PuertosParaJugar,
  avisos: AvisosDelNivel,
): Promise<NivelEnJuego> {
  const { nivel, ubicacion } = pedido;
  const { escenario, interfaz, audio, controles, reloj } = puertos;

  await escenario.montar(prepararEscenografia(nivel, ubicacion));
  const reparto = new Reparto(escenario);
  const personajes = prepararPersonajes(nivel, ubicacion);
  // Todas las imágenes de personajes se piden a la vez, para que la carga dure lo que dura la más lenta.
  await Promise.all(personajes.map((personaje) => reparto.agregar(personaje)));

  const exploracion = crearExploracion(nivel, escenario, reparto);

  const estadoInicial = crearEstadoDeNivel(nivel.contenido.estado, pedido.variablesGuardadas);
  const estado = new EstadoEnJuego(estadoInicial, (objetivo) => avisos.alCumplirObjetivo(objetivo));
  const centroDelLugar = { x: nivel.mundo.anchoEnMetros / 2, y: nivel.mundo.profundidadEnMetros / 2 };
  const direccionDeAsset = (clave: string): string | undefined => {
    return buscarDireccionDeAsset(clave, nivel.assets, ubicacion);
  };

  const piezasDeEscena: PiezasDeEscena = {
    contenido: nivel.contenido,
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

  if (exploracion === undefined) {
    // Un nivel sin jugador no tiene a quién seguir: la cámara mira al centro del lugar.
    escenario.enfocar(centroDelLugar, nivel.contenido.mundo.camara, { deInmediato: true });
  }
  const musica = nivel.contenido.mundo.sonidos.musica;
  if (musica !== undefined) {
    // Si la música no está en los assets, la validación ya lo advirtió: el nivel se juega sin ella.
    audio.ponerMusica(direccionDeAsset(musica));
  }

  const comentarios = new ComentariosDeZona({
    contenido: nivel.contenido,
    zonas: nivel.mundo.zonas,
    azar: puertos.azar,
    decirComentario(linea, senal) {
      const textoCompleto = completarTexto(linea.texto, estado.actual);
      return decirLinea({ paso: linea, textoCompleto, seCierraConUnToque: false }, senal, piezasDeEscena);
    },
    alFallar: (error) => avisos.alFallar(error),
  });
  const conversacion = new Conversacion({
    contenido: nivel.contenido,
    estado,
    acciones: crearAccionesDePaso(piezasDeEscena),
    alFallar: (error) => avisos.alFallar(error),
    // Un comentario nunca se encima con un diálogo: al empezar uno, el comentario se calla.
    alEmpezar: () => comentarios.callar(),
  });

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
    if (exploracion !== undefined) {
      // Durante un diálogo o un minijuego, el teclado no mueve al jugador.
      const direccion = conversacion.hayDialogoEnCurso ? SIN_DIRECCION : controles.leerDireccion();
      exploracion.avanzar(segundos, direccion);
      comentarios.avanzar(segundos, exploracion.posicion, !conversacion.hayDialogoEnCurso);
      salida.vigilar(exploracion.posicion);
      cercania.actualizar(exploracion.posicion, !conversacion.hayDialogoEnCurso);
    }
    escenario.dibujar(segundos);
    // La flecha se coloca después de dibujar, cuando la cámara ya está en su lugar de este cuadro.
    flecha.actualizar();
  });

  return {
    leerVariables(): VariablesDeEstado {
      return estado.actual.variables;
    },
    interrumpir(): void {
      conversacion.interrumpir();
    },
    terminar(): void {
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
function crearExploracion(nivel: Nivel, escenario: Escenario, reparto: Reparto): Exploracion | undefined {
  const jugador = nivel.contenido.jugador;
  if (jugador === undefined) return undefined;

  return new Exploracion({
    escenario,
    reparto,
    terreno: crearTerreno(nivel.mundo),
    idDelJugador: jugador.personaje,
    velocidadEnMetrosPorSegundo: jugador.velocidadEnMetrosPorSegundo,
    camara: nivel.contenido.mundo.camara,
  });
}
